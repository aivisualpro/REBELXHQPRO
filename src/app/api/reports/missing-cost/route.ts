import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import SaleOrder from '@/models/SaleOrder';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

// ⚡ In-memory cache (2 min TTL)
const CACHE_TTL = 120_000;
let summaryCache: { data: any; timestamp: number } | null = null;
let detailCache = new Map<string, { data: any; timestamp: number }>();

// Lot numbers that are considered "not real" (no cost expected)
const INVALID_LOT_VALUES = [null, '', 'N/A', 'Allocated'];

// Helper to catch all forms of missing/empty cost in DB
const missingCostOr = (field: string) => [
    { [field]: { $exists: false } },
    { [field]: null },
    { [field]: 0 },
    { [field]: '' },
    { [field]: '0' },
    { [field]: '-' }
];

/**
 * GET /api/reports/missing-cost
 * 
 * ?skuId=xxx  → returns items for a specific SKU (lazy-loaded)
 * no skuId    → returns sidebar summary (groups with counts, no items)
 * 
 * Shows transactions that HAVE a valid lot number but cost = 0 or missing
 */
export async function GET(request: NextRequest) {
    const skuId = new URL(request.url).searchParams.get('skuId');

    if (skuId) {
        return getSkuDetail(skuId);
    }
    return getSummary();
}

// ── Get sidebar summary (lightweight) ──
async function getSummary() {
    if (summaryCache && (Date.now() - summaryCache.timestamp) < CACHE_TTL) {
        return apiSuccess(summaryCache.data);
    }

    try {
        await dbConnect();

        // ── Fetch global start date filter ──
        const globalStartDate = await getGlobalStartDate();

        const [woGroups, soGroups, obGroups, poGroups, mfgGroups, mfgConGroups, allSkus] = await Promise.all([
            // ⚡ Web Orders: line items with valid lotNumber but cost=0/null
            WebOrder.aggregate([
                {
                    $match: {
                        status: { $nin: ['cancelled', 'trash', 'failed', 'refunded'] },
                        'lineItems.linkedSkuId': { $exists: true, $ne: null },
                        ...(globalStartDate ? { dateCreated: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.linkedSkuId': { $exists: true, $ne: null },
                        // Has a REAL lot number (not empty/null/N/A/Allocated)
                        'lineItems.lotNumber': { $exists: true, $nin: INVALID_LOT_VALUES },
                        // But cost is 0 or missing
                        $or: missingCostOr('lineItems.cost')
                    }
                },
                {
                    $sort: { dateCreated: 1 }
                },
                {
                    $group: {
                        _id: { sku: '$lineItems.linkedSkuId', lot: '$lineItems.lotNumber' },
                        quantity: { $first: { $ifNull: ['$lineItems.quantity', 0] } },
                        total: { $first: { $toDouble: { $ifNull: ['$lineItems.total', 0] } } }
                    }
                },
                {
                    $group: {
                        _id: '$_id.sku',
                        count: { $sum: 1 },
                        totalQty: { $sum: '$quantity' },
                        totalValue: { $sum: '$total' },
                    }
                }
            ]).allowDiskUse(true),

            // ⚡ Sale Orders: line items with valid lotNumber but cost=0/null
            SaleOrder.aggregate([
                {
                    $match: {
                        status: { $nin: ['Cancelled', 'Voided'] },
                        ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.sku': { $exists: true, $ne: null },
                        'lineItems.lotNumber': { $exists: true, $nin: INVALID_LOT_VALUES },
                        $or: missingCostOr('lineItems.cost')
                    }
                },
                {
                    $sort: { createdAt: 1 }
                },
                {
                    $group: {
                        _id: { sku: '$lineItems.sku', lot: '$lineItems.lotNumber' },
                        qty: { $first: { $ifNull: ['$lineItems.qty', 0] } },
                        price: { $first: { $ifNull: ['$lineItems.price', 0] } }
                    }
                },
                {
                    $group: {
                        _id: '$_id.sku',
                        count: { $sum: 1 },
                        totalQty: { $sum: '$qty' },
                        totalValue: {
                            $sum: {
                                $multiply: [
                                    '$qty',
                                    '$price'
                                ]
                            }
                        },
                    }
                }
            ]).allowDiskUse(true),

            // ⚡ Opening Balances: valid lotNumber but cost=0/null
            OpeningBalance.aggregate([
                {
                    $match: {
                        // Removed globalStartDate filter: Opening Balances carry forward indefinitely
                        sku: { $exists: true, $ne: null },
                        lotNumber: { $exists: true, $nin: INVALID_LOT_VALUES },
                        $or: missingCostOr('cost')
                    }
                },
                {
                    $group: {
                        _id: { sku: '$sku', lot: '$lotNumber' },
                        quantity: { $first: { $ifNull: ['$qty', 0] } },
                        total: { $first: 0 }
                    }
                },
                {
                    $group: {
                        _id: '$_id.sku',
                        count: { $sum: 1 },
                        totalQty: { $sum: '$quantity' },
                        totalValue: { $sum: 0 },
                    }
                }
            ]).allowDiskUse(true),

            // ⚡ Purchase Orders: line items with valid lotNumber but cost=0/null and price=0/null
            PurchaseOrder.aggregate([
                {
                    $match: {
                        status: { $nin: ['Cancelled', 'Void'] },
                        ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.sku': { $exists: true, $ne: null },
                        'lineItems.lotNumber': { $exists: true, $nin: INVALID_LOT_VALUES },
                        $and: [
                            { $or: missingCostOr('lineItems.cost') },
                            { $or: missingCostOr('lineItems.price') }
                        ]
                    }
                },
                {
                    $group: {
                        _id: { sku: '$lineItems.sku', lot: '$lineItems.lotNumber' },
                        quantity: { $first: { $ifNull: ['$lineItems.qtyReceived', '$lineItems.qty'] } },
                        total: { $first: 0 }
                    }
                },
                {
                    $group: {
                        _id: '$_id.sku',
                        count: { $sum: 1 },
                        totalQty: { $sum: '$quantity' },
                        totalValue: { $sum: 0 },
                    }
                }
            ]).allowDiskUse(true),

            // ⚡ Manufacturing: valid lotNumber but totalCost=0/null
            Manufacturing.aggregate([
                {
                    $match: {
                        status: { $nin: ['cancelled'] },
                        ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                        sku: { $exists: true, $ne: null },
                        $or: missingCostOr('totalCost')
                    }
                },
                {
                    $project: {
                        sku: 1,
                        qty: 1,
                        qtyDifference: 1,
                        lot: { $ifNull: ['$lotNumber', '$label'] }
                    }
                },
                {
                    $match: {
                        lot: { $exists: true, $nin: INVALID_LOT_VALUES }
                    }
                },
                {
                    $group: {
                        _id: { sku: '$sku', lot: '$lot' },
                        quantity: { $first: { $add: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$qtyDifference', 0] }] } },
                        total: { $first: 0 }
                    }
                },
                {
                    $group: {
                        _id: '$_id.sku',
                        count: { $sum: 1 },
                        totalQty: { $sum: '$quantity' },
                        totalValue: { $sum: 0 },
                    }
                }
            ]).allowDiskUse(true),

            // ⚡ Manufacturing Consumption (Line Items)
            Manufacturing.aggregate([
                {
                    $match: {
                        status: { $nin: ['cancelled'] },
                        ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.sku': { $exists: true, $ne: null },
                        'lineItems.lotNumber': { $exists: true, $nin: INVALID_LOT_VALUES },
                        $or: missingCostOr('lineItems.cost')
                    }
                },
                {
                    $group: {
                        _id: { sku: '$lineItems.sku', lot: '$lineItems.lotNumber' },
                        quantity: { $first: { $ifNull: ['$lineItems.qty', 0] } },
                        total: { $first: 0 }
                    }
                },
                {
                    $group: {
                        _id: '$_id.sku',
                        count: { $sum: 1 },
                        totalQty: { $sum: '$quantity' },
                        totalValue: { $sum: 0 },
                    }
                }
            ]).allowDiskUse(true),

            Sku.find({ isArchived: { $ne: true } })
                .select('_id name category uom')
                .lean(),
        ]);

        // Build SKU lookup
        const skuMap = new Map<string, any>();
        allSkus.forEach((s: any) => skuMap.set(s._id.toString(), s));

        // Merge groups
        const mergedMap = new Map<string, { count: number; totalQty: number; totalValue: number }>();

        for (const groups of [woGroups, soGroups, obGroups, poGroups, mfgGroups, mfgConGroups]) {
            for (const g of groups) {
                const id = g._id?.toString();
                if (!id) continue;
                const existing = mergedMap.get(id) || { count: 0, totalQty: 0, totalValue: 0 };
                existing.count += g.count;
                existing.totalQty += g.totalQty;
                existing.totalValue += g.totalValue;
                mergedMap.set(id, existing);
            }
        }

        // Build response
        const groups = Array.from(mergedMap.entries())
            .map(([skuId, stats]) => {
                const skuData = skuMap.get(skuId);
                if (!skuData) return null; // Ignore unknown or archived SKUs
                return {
                    skuId,
                    name: skuData.name,
                    category: skuData.category || '',
                    uom: skuData.uom || 'EA',
                    count: stats.count,
                    totalQty: stats.totalQty,
                    totalValue: stats.totalValue,
                };
            })
            .filter((g): g is any => g !== null)
            .sort((a, b) => b.totalQty - a.totalQty);

        const result = {
            groups,
            summary: {
                totalSkus: groups.length,
                totalItems: groups.reduce((s, g) => s + g.count, 0),
                totalQty: groups.reduce((s, g) => s + g.totalQty, 0),
                totalValue: groups.reduce((s, g) => s + g.totalValue, 0),
            }
        };

        summaryCache = { data: result, timestamp: Date.now() };
        return apiSuccess(result);

    } catch (error: any) {
        console.error('Missing Cost summary error:', error);
        return apiError(error.message, 500);
    }
}

// ── Get detail items for a specific SKU (lazy-loaded) ──
async function getSkuDetail(skuId: string) {
    const cached = detailCache.get(skuId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return apiSuccess(cached.data);
    }

    try {
        await dbConnect();

        // ── Fetch global start date filter ──
        const globalStartDate = await getGlobalStartDate();
        const skuOid = import('mongoose').then(m => m.default.Types.ObjectId.isValid(skuId) ? new m.default.Types.ObjectId(skuId) : skuId);
        const resolvedSkuOid = await skuOid;
        const skuMatch = { $in: [resolvedSkuOid, skuId] };

        const [woItems, soItems, obItems, poItems, mfgItems, mfgConItems] = await Promise.all([
            WebOrder.aggregate([
                {
                    $match: {
                        status: { $nin: ['cancelled', 'trash', 'failed', 'refunded'] },
                        ...(globalStartDate ? { dateCreated: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.linkedSkuId': skuMatch,
                        'lineItems.lotNumber': { $exists: true, $nin: INVALID_LOT_VALUES },
                        $or: missingCostOr('lineItems.cost')
                    }
                },
                {
                    $project: {
                        _id: 1,
                        number: 1,
                        website: 1,
                        status: 1,
                        dateCreated: 1,
                        'lineItems.id': 1,
                        'lineItems.quantity': 1,
                        'lineItems.total': 1,
                        'lineItems.lotNumber': 1,
                        'lineItems.cost': 1,
                    }
                },
                { $sort: { dateCreated: -1 } },
            ]).allowDiskUse(true),

            SaleOrder.aggregate([
                {
                    $match: {
                        status: { $nin: ['Cancelled', 'Voided'] },
                        ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.sku': skuMatch,
                        'lineItems.lotNumber': { $exists: true, $nin: INVALID_LOT_VALUES },
                        $or: missingCostOr('lineItems.cost')
                    }
                },
                {
                    $project: {
                        _id: 1,
                        label: 1,
                        status: 1,
                        createdAt: 1,
                        'lineItems.qty': 1,
                        'lineItems.price': 1,
                        'lineItems.lotNumber': 1,
                        'lineItems.cost': 1,
                    }
                },
                { $sort: { createdAt: -1 } },
            ]).allowDiskUse(true),

            OpeningBalance.aggregate([
                {
                    $match: {
                        // Removed globalStartDate filter: Opening Balances carry forward indefinitely
                        sku: skuMatch,
                        lotNumber: { $exists: true, $nin: INVALID_LOT_VALUES },
                        $or: missingCostOr('cost')
                    }
                },
                {
                    $project: {
                        _id: 1,
                        createdAt: 1,
                        qty: 1,
                        lotNumber: 1,
                        cost: 1,
                    }
                },
                { $sort: { createdAt: -1 } },
            ]).allowDiskUse(true),

            PurchaseOrder.aggregate([
                {
                    $match: {
                        status: { $nin: ['Cancelled', 'Void'] },
                        ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.sku': skuMatch,
                        'lineItems.lotNumber': { $exists: true, $nin: INVALID_LOT_VALUES },
                        $and: [
                            { $or: missingCostOr('lineItems.cost') },
                            { $or: missingCostOr('lineItems.price') }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        label: 1,
                        status: 1,
                        createdAt: 1,
                        'lineItems.qtyReceived': 1,
                        'lineItems.qty': 1,
                        'lineItems.price': 1,
                        'lineItems.lotNumber': 1,
                        'lineItems.cost': 1,
                    }
                },
                { $sort: { createdAt: -1 } },
            ]).allowDiskUse(true),

            Manufacturing.aggregate([
                {
                    $match: {
                        status: { $nin: ['cancelled'] },
                        ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                        sku: skuMatch,
                        $or: missingCostOr('totalCost')
                    }
                },
                {
                    $project: {
                        _id: 1,
                        label: 1,
                        status: 1,
                        createdAt: 1,
                        qty: 1,
                        qtyDifference: 1,
                        lotNumber: 1,
                        totalCost: 1,
                        lot: { $ifNull: ['$lotNumber', '$label'] }
                    }
                },
                {
                    $match: {
                        lot: { $exists: true, $nin: INVALID_LOT_VALUES }
                    }
                },
                { $sort: { createdAt: -1 } },
            ]).allowDiskUse(true),

            Manufacturing.aggregate([
                {
                    $match: {
                        status: { $nin: ['cancelled'] },
                        ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.sku': skuMatch,
                        'lineItems.lotNumber': { $exists: true, $nin: INVALID_LOT_VALUES },
                        $or: missingCostOr('lineItems.cost')
                    }
                },
                {
                    $project: {
                        _id: 1,
                        label: 1,
                        status: 1,
                        createdAt: 1,
                        'lineItems.qty': 1,
                        'lineItems.lotNumber': 1,
                        'lineItems.cost': 1,
                    }
                },
                { $sort: { createdAt: -1 } },
            ]).allowDiskUse(true),
        ]);

        const items: any[] = [];

        for (const wo of woItems) {
            const line = wo.lineItems;
            items.push({
                id: `WO_${wo._id}_${line.id}`,
                source: 'Web Order',
                orderId: wo._id,
                lineItemId: line.id,
                orderNumber: wo.number || wo._id,
                website: wo.website || '',
                status: wo.status || '',
                date: wo.dateCreated || '',
                lotNumber: line.lotNumber || '',
                cost: line.cost || 0,
                quantity: line.quantity || 0,
                total: parseFloat(line.total) || 0,
                link: `/sales/web-orders/${wo._id}`,
            });
        }

        for (const so of soItems) {
            const line = so.lineItems;
            items.push({
                id: `SO_${so._id}`,
                source: 'Sale Order',
                orderId: so._id.toString(),
                orderNumber: so.label || so._id.toString(),
                status: so.status || '',
                date: so.createdAt || '',
                lotNumber: line.lotNumber || '',
                cost: line.cost || 0,
                quantity: line.qty || 0,
                total: (line.qty || 0) * (line.price || 0),
                link: `/sales/wholesale-orders/${so._id}`,
            });
        }

        for (const ob of obItems) {
            items.push({
                id: `OB_${ob._id}`,
                source: 'Opening Balance',
                orderId: ob._id.toString(),
                orderNumber: 'Opening Balance',
                status: 'Completed',
                date: ob.createdAt || '',
                lotNumber: ob.lotNumber || '',
                cost: ob.cost || 0,
                quantity: ob.qty || 0,
                total: 0,
                link: `/warehouse/opening-balances/${ob._id}`,
            });
        }

        for (const po of poItems) {
            const line = po.lineItems;
            items.push({
                id: `PO_${po._id}`,
                source: 'Purchase Order',
                orderId: po._id.toString(),
                orderNumber: po.label || po._id.toString(),
                status: po.status || '',
                date: po.createdAt || '',
                lotNumber: line.lotNumber || '',
                cost: line.cost || line.price || 0,
                quantity: line.qtyReceived || line.qty || 0,
                total: 0,
                link: `/warehouse/purchase-orders/${po._id}`,
            });
        }

        for (const mfg of mfgItems) {
            items.push({
                id: `MFG_${mfg._id}`,
                source: 'Manufacturing',
                orderId: mfg._id.toString(),
                orderNumber: mfg.label || mfg._id.toString(),
                status: mfg.status || '',
                date: mfg.createdAt || '',
                lotNumber: mfg.lot || '',
                cost: mfg.totalCost || 0,
                quantity: (mfg.qty || 0) + (mfg.qtyDifference || 0),
                total: 0,
                link: `/warehouse/manufacturing/${mfg._id}`,
            });
        }

        for (const mfgCon of mfgConItems) {
            const line = mfgCon.lineItems;
            items.push({
                id: `MFG_CON_${mfgCon._id}_${line.lotNumber}`,
                source: 'Mfg. Consumption',
                orderId: mfgCon._id.toString(),
                orderNumber: mfgCon.label || mfgCon._id.toString(),
                status: mfgCon.status || '',
                date: mfgCon.createdAt || '',
                lotNumber: line.lotNumber || '',
                cost: line.cost || 0,
                quantity: line.qty || 0,
                total: 0,
                link: `/warehouse/manufacturing/${mfgCon._id}`,
            });
        }

        // Sort by date ascending to get the oldest (origin) transaction first
        items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const uniqueItems: any[] = [];
        const seenLots = new Set<string>();

        for (const item of items) {
            if (!seenLots.has(item.lotNumber)) {
                seenLots.add(item.lotNumber);
                uniqueItems.push(item);
            }
        }

        // Sort by date desc for display
        uniqueItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const result = { items: uniqueItems };
        detailCache.set(skuId, { data: result, timestamp: Date.now() });

        return apiSuccess(result);

    } catch (error: any) {
        console.error('Missing Cost detail error:', error);
        return apiError(error.message, 500);
    }
}
