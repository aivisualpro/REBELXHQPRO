import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import SaleOrder from '@/models/SaleOrder';
import Sku from '@/models/Sku';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

// ⚡ In-memory cache (2 min TTL)
const CACHE_TTL = 120_000;
let summaryCache: { data: any; timestamp: number } | null = null;
let detailCache = new Map<string, { data: any; timestamp: number }>();

/**
 * GET /api/reports/waiting-on-lot
 * 
 * ?skuId=xxx  → returns items for a specific SKU (lazy-loaded)
 * no skuId    → returns sidebar summary (groups with counts, no items)
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
        return NextResponse.json(summaryCache.data);
    }

    try {
        await dbConnect();

        // ── Fetch global start date filter ──
        const globalStartDate = await getGlobalStartDate();

        const [woGroups, soGroups, allSkus] = await Promise.all([
            // ⚡ Web Orders: group by SKU, count items
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
                        $or: [
                            { 'lineItems.lotNumber': { $exists: false } },
                            { 'lineItems.lotNumber': null },
                            { 'lineItems.lotNumber': '' },
                            { 'lineItems.lotNumber': 'N/A' },
                            { 'lineItems.lotNumber': 'Allocated' },
                        ]
                    }
                },
                {
                    $group: {
                        _id: '$lineItems.linkedSkuId',
                        count: { $sum: 1 },
                        totalQty: { $sum: { $ifNull: ['$lineItems.quantity', 0] } },
                        totalValue: { $sum: { $toDouble: { $ifNull: ['$lineItems.total', 0] } } },
                    }
                }
            ]).allowDiskUse(true),

            // ⚡ Sale Orders: group by SKU
            SaleOrder.aggregate([
                { $match: { status: { $nin: ['Cancelled', 'Voided'] }, ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}) } },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.sku': { $exists: true, $ne: null },
                        $or: [
                            { 'lineItems.lotNumber': { $exists: false } },
                            { 'lineItems.lotNumber': null },
                            { 'lineItems.lotNumber': '' },
                            { 'lineItems.lotNumber': 'N/A' },
                            { 'lineItems.lotNumber': 'Allocated' },
                        ]
                    }
                },
                {
                    $group: {
                        _id: '$lineItems.sku',
                        count: { $sum: 1 },
                        totalQty: { $sum: { $ifNull: ['$lineItems.qty', 0] } },
                        totalValue: {
                            $sum: {
                                $multiply: [
                                    { $ifNull: ['$lineItems.qty', 0] },
                                    { $ifNull: ['$lineItems.price', 0] }
                                ]
                            }
                        },
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

        // Merge WO + SO groups
        const mergedMap = new Map<string, { count: number; totalQty: number; totalValue: number }>();

        for (const g of woGroups) {
            const id = g._id?.toString();
            if (!id) continue;
            const existing = mergedMap.get(id) || { count: 0, totalQty: 0, totalValue: 0 };
            existing.count += g.count;
            existing.totalQty += g.totalQty;
            existing.totalValue += g.totalValue;
            mergedMap.set(id, existing);
        }

        for (const g of soGroups) {
            const id = g._id?.toString();
            if (!id) continue;
            const existing = mergedMap.get(id) || { count: 0, totalQty: 0, totalValue: 0 };
            existing.count += g.count;
            existing.totalQty += g.totalQty;
            existing.totalValue += g.totalValue;
            mergedMap.set(id, existing);
        }

        // Build response
        const groups = Array.from(mergedMap.entries())
            .map(([skuId, stats]) => {
                const skuData = skuMap.get(skuId);
                return {
                    skuId,
                    name: skuData?.name || 'Unknown SKU',
                    category: skuData?.category || '',
                    uom: skuData?.uom || 'EA',
                    count: stats.count,
                    totalQty: stats.totalQty,
                    totalValue: stats.totalValue,
                };
            })
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
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Waiting on Lot summary error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ── Get detail items for a specific SKU (lazy-loaded) ──
async function getSkuDetail(skuId: string) {
    const cached = detailCache.get(skuId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
        await dbConnect();

        // ── Fetch global start date filter ──
        const globalStartDate = await getGlobalStartDate();

        const [woItems, soItems] = await Promise.all([
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
                        'lineItems.linkedSkuId': skuId,
                        $or: [
                            { 'lineItems.lotNumber': { $exists: false } },
                            { 'lineItems.lotNumber': null },
                            { 'lineItems.lotNumber': '' },
                            { 'lineItems.lotNumber': 'N/A' },
                            { 'lineItems.lotNumber': 'Allocated' },
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                        number: 1,
                        website: 1,
                        status: 1,
                        dateCreated: 1,
                        'billing.firstName': 1,
                        'billing.lastName': 1,
                        'lineItems.id': 1,
                        'lineItems.quantity': 1,
                        'lineItems.total': 1,
                    }
                },
                { $sort: { dateCreated: -1 } },
            ]).allowDiskUse(true),

            SaleOrder.aggregate([
                { $match: { status: { $nin: ['Cancelled', 'Voided'] }, ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}) } },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.sku': skuId,
                        $or: [
                            { 'lineItems.lotNumber': { $exists: false } },
                            { 'lineItems.lotNumber': null },
                            { 'lineItems.lotNumber': '' },
                            { 'lineItems.lotNumber': 'N/A' },
                            { 'lineItems.lotNumber': 'Allocated' },
                        ]
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
                quantity: line.qty || 0,
                total: (line.qty || 0) * (line.price || 0),
                link: `/sales/wholesale-orders/${so._id}`,
            });
        }

        // Sort by date desc
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const result = { items };
        detailCache.set(skuId, { data: result, timestamp: Date.now() });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Waiting on Lot detail error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
