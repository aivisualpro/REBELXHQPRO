import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import SaleOrder from '@/models/SaleOrder';
import WebProduct from '@/models/WebProduct';
import Sku from '@/models/Sku';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

// ⚡ In-memory cache (2 min TTL)
const CACHE_TTL = 120_000;
let summaryCache: { data: any; timestamp: number } | null = null;
let detailCache = new Map<string, { data: any; timestamp: number }>();
// Bust caches on startup so N/A rule changes take effect immediately
summaryCache = null;
detailCache.clear();

// Lot values we consider "missing"
const MISSING_LOT_OR = [
    { 'lineItems.lotNumber': { $exists: false } },
    { 'lineItems.lotNumber': null },
    { 'lineItems.lotNumber': '' },
    { 'lineItems.lotNumber': '-' },
    { 'lineItems.lotNumber': 'Allocated' },
];

/**
 * GET /api/reports/waiting-on-lot
 * 
 * ?skuId=xxx  → returns items for a specific SKU (lazy-loaded)
 * no skuId    → returns sidebar summary (groups with counts, no items)
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const skuId = url.searchParams.get('skuId');
    const bust = url.searchParams.get('bust') === '1';

    if (skuId) {
        return getSkuDetail(skuId, bust);
    }
    return getSummary(bust);
}

// ── Get sidebar summary (lightweight) ──
async function getSummary(bust = false) {
    if (!bust && summaryCache && (Date.now() - summaryCache.timestamp) < CACHE_TTL) {
        return NextResponse.json(summaryCache.data);
    }

    try {
        await dbConnect();

        // ── Fetch global start date filter ──
        const globalStartDate = await getGlobalStartDate();

        const [woGroups, soGroups, allSkus] = await Promise.all([
            // ⚡ Web Orders: group by SKU, count items missing lot
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
                        $or: MISSING_LOT_OR,
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
                            { 'lineItems.lotNumber': '-' },
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

        // ── Phase 2: WebProduct-resolved web orders ──
        const allSkuIds = Array.from(skuMap.keys());
        const webProducts = await WebProduct.find({
            $or: [
                { linkedSkuId: { $exists: true, $ne: null } },
                { 'variations.linkedSkuId': { $exists: true, $ne: null } },
                { 'linkedSkus.0': { $exists: true } },
                { 'variations.linkedSkus.0': { $exists: true } },
            ]
        }).select('webId website linkedSkuId linkedSkus multiplier variations').lean();

        // Build: skuId -> [{ website, productId, variationId?, multiplier }]
        const wpResolutions: { skuId: string; website: string; productId: number; variationId?: number; multiplier: number }[] = [];
        (webProducts as any[]).forEach(wp => {
            // Product-level direct link
            if (wp.linkedSkuId && allSkuIds.includes(wp.linkedSkuId?.toString())) {
                wpResolutions.push({ skuId: wp.linkedSkuId.toString(), website: wp.website, productId: wp.webId, multiplier: wp.multiplier || 1 });
            }
            // Product-level linkedSkus
            wp.linkedSkus?.forEach((ls: any) => {
                if (ls.skuId && allSkuIds.includes(ls.skuId?.toString())) {
                    wpResolutions.push({ skuId: ls.skuId.toString(), website: wp.website, productId: wp.webId, multiplier: ls.multiplier || 1 });
                }
            });
            // Variation-level
            wp.variations?.forEach((v: any) => {
                const vid = v.id || v._id;
                if (v.linkedSkuId && allSkuIds.includes(v.linkedSkuId?.toString())) {
                    wpResolutions.push({ skuId: v.linkedSkuId.toString(), website: wp.website, productId: wp.webId, variationId: vid, multiplier: v.multiplier || wp.multiplier || 1 });
                }
                v.linkedSkus?.forEach((ls: any) => {
                    if (ls.skuId && allSkuIds.includes(ls.skuId?.toString())) {
                        wpResolutions.push({ skuId: ls.skuId.toString(), website: wp.website, productId: wp.webId, variationId: vid, multiplier: ls.multiplier || 1 });
                    }
                });
            });
        });

        // Group WebProduct resolutions by website+productId for querying
        const wpProductKeys = new Set<string>();
        const wpWebIds: number[] = [];
        const wpWebsites: string[] = [];
        wpResolutions.forEach(r => {
            const key = `${r.website}-${r.productId}`;
            if (!wpProductKeys.has(key)) {
                wpProductKeys.add(key);
                wpWebIds.push(r.productId);
                if (!wpWebsites.includes(r.website)) wpWebsites.push(r.website);
            }
        });
        const wpWebIdsUnique = wpWebIds; // productId is always Number per schema

        if (wpWebIds.length > 0) {
            // Fetch ALL web orders matched via WebProduct productId
            // Do NOT filter by lot status here — for WP-resolved items, the ledger
            // treats them as always "missing lot" regardless of lineItems.lotNumber.
            const wpWoGroups = await WebOrder.aggregate([
                {
                    $match: {
                        status: { $nin: ['cancelled', 'trash', 'failed', 'refunded'] },
                        'lineItems.productId': { $in: wpWebIdsUnique },
                        website: { $in: wpWebsites },
                        ...(globalStartDate ? { dateCreated: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.productId': { $in: wpWebIdsUnique },
                    }
                },
                {
                    $project: {
                        _id: 1,
                        website: 1,
                        'lineItems.id': 1,
                        'lineItems._id': 1,
                        'lineItems.productId': 1,
                        'lineItems.variationId': 1,
                        'lineItems.quantity': 1,
                        'lineItems.total': 1,
                        'lineItems.linkedSkuId': 1,
                        'lineItems.lotNumber': 1,
                        'lineItems.linkedSkus': 1,
                    }
                }
            ]).allowDiskUse(true);

            // Deduplicate: track (orderId_lineId_skuId) to prevent double-counting
            // items already counted via Phase 1 (direct linkedSkuId WITH missing lot).
            // IMPORTANT: only block lines that Phase 1 actually counted (missing direct lot).
            // If a line has linkedSkuId with an assigned lot, Phase 1 did NOT count it —
            // Phase 2 still needs to check linkedSkus[].lotNumber for that line.
            const counted = new Set<string>();
            const MISSING_LOT_VALUES = new Set(['', '-', 'Allocated']);

            for (const wo of wpWoGroups) {
                const line = wo.lineItems;
                if (line.linkedSkuId) {
                    const directLot = line.lotNumber ?? '';
                    const directIsMissing = !directLot || MISSING_LOT_VALUES.has(directLot);
                    if (directIsMissing) {
                        // Phase 1 counted this line — block Phase 2 from double-counting
                        counted.add(`${wo._id}_${line.id || line._id}_${line.linkedSkuId.toString()}`);
                    }
                    // If lot is assigned on direct match, Phase 2 must still check
                    // linkedSkus[].lotNumber for bundle component tracking
                }
            }

            // Resolve each matched line item to a SKU via the wpResolutions map
            for (const wo of wpWoGroups) {
                const line = wo.lineItems;

                // Find matching WebProduct resolution
                const matchingRes = wpResolutions.filter(r =>
                    r.website === wo.website && String(r.productId) === String(line.productId)
                );

                for (const res of matchingRes) {
                    // If resolution has a variationId, only match if line has that variationId
                    if (res.variationId && String(line.variationId) !== String(res.variationId)) continue;
                    // If resolution has no variationId and line has one, skip (variation-level should match)
                    if (!res.variationId && line.variationId && matchingRes.some(r => r.variationId && String(r.variationId) === String(line.variationId))) continue;

                    const dedupeKey = `${wo._id}_${line.id || line._id}_${res.skuId}`;
                    if (counted.has(dedupeKey)) continue;
                    counted.add(dedupeKey);

                    // Determine lot status using the same logic as the ledger:
                    // - Direct match (linkedSkuId === skuId): check lineItems.lotNumber
                    // - LinkedSkus match: check linkedSkus[].lotNumber
                    // - WP-resolved: always treated as missing lot
                    const isDirectMatch = line.linkedSkuId?.toString() === res.skuId;
                    const linkedSkuMatch = line.linkedSkus?.find((ls: any) => ls.skuId?.toString() === res.skuId);

                    let lot = '';
                    if (linkedSkuMatch) {
                        lot = linkedSkuMatch.lotNumber || '';
                    } else if (isDirectMatch) {
                        lot = line.lotNumber || '';
                    } else {
                        // WP-resolved: lot was saved to line.lotNumber by transaction-update
                        lot = line.lotNumber || '';
                    }

                    const isMissing = !lot || lot === '' || lot === '-' || lot === 'Allocated';
                    if (!isMissing) continue;

                    const existing = mergedMap.get(res.skuId) || { count: 0, totalQty: 0, totalValue: 0 };
                    existing.count += 1;
                    existing.totalQty += (line.quantity || 0) * res.multiplier;
                    existing.totalValue += parseFloat(line.total || '0') || 0;
                    mergedMap.set(res.skuId, existing);
                }
            }
        }

        // Build response
        const groups = Array.from(mergedMap.entries())
            .map(([skuId, stats]) => {
                const skuData = skuMap.get(skuId);
                if (!skuData) return null; // Drop unknown or archived SKUs
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
            .filter((g): g is any => g !== null && g.totalQty > 0)
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
async function getSkuDetail(skuId: string, bust = false) {
    const cached = detailCache.get(skuId);
    if (!bust && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
        await dbConnect();

        // ── Fetch global start date filter ──
        const globalStartDate = await getGlobalStartDate();

        // ── Phase 1: Fetch WebProducts that reference this SKU ──
        const webProducts = await WebProduct.find({
            $or: [
                { linkedSkuId: skuId },
                { 'variations.linkedSkuId': skuId },
                { 'linkedSkus.skuId': skuId },
                { 'variations.linkedSkus.skuId': skuId },
            ]
        }).select('webId website linkedSkuId linkedSkus multiplier variations').lean();

        // Build WebProduct lookup: website+productId -> variationId -> multiplier
        const wpMultiplierMap = new Map<string, Map<number | string, number>>();
        (webProducts as any[]).forEach(wp => {
            const wpKey = `${wp.website}-${wp.webId}`;
            // Product-level
            if (wp.linkedSkuId === skuId) {
                if (!wpMultiplierMap.has(wpKey)) wpMultiplierMap.set(wpKey, new Map());
                wpMultiplierMap.get(wpKey)!.set('simple', wp.multiplier || 1);
            }
            if (wp.linkedSkus?.some((ls: any) => ls.skuId === skuId)) {
                const match = wp.linkedSkus.find((ls: any) => ls.skuId === skuId);
                if (!wpMultiplierMap.has(wpKey)) wpMultiplierMap.set(wpKey, new Map());
                wpMultiplierMap.get(wpKey)!.set('simple', match.multiplier || 1);
            }
            // Variation-level
            wp.variations?.forEach((v: any) => {
                const vid = v.id || v._id;
                const varLinked = v.linkedSkuId === skuId;
                const varLsMatch = v.linkedSkus?.find((ls: any) => ls.skuId === skuId);
                if (varLinked || varLsMatch) {
                    if (!wpMultiplierMap.has(wpKey)) wpMultiplierMap.set(wpKey, new Map());
                    wpMultiplierMap.get(wpKey)!.set(vid, varLsMatch?.multiplier || v.multiplier || wp.multiplier || 1);
                }
            });
        });

        // Build query for web orders: combine direct + WebProduct resolution
        const wpWebIds = (webProducts as any[]).map((wp: any) => wp.webId).filter(Boolean);
        const wpWebsites = [...new Set((webProducts as any[]).map((wp: any) => wp.website).filter(Boolean))];

        const woMatchOr: any[] = [
            { 'lineItems.linkedSkuId': skuId },
            { 'lineItems.linkedSkus.skuId': skuId },
        ];
        if (wpWebIds.length > 0) {
            woMatchOr.push({ 'lineItems.productId': { $in: wpWebIds }, website: { $in: wpWebsites } });
        }

        const innerMatchOr: any[] = [
            { 'lineItems.linkedSkuId': skuId },
            { 'lineItems.linkedSkus.skuId': skuId },
        ];
        if (wpWebIds.length > 0) {
            innerMatchOr.push({ 'lineItems.productId': { $in: wpWebIds } });
        }

        const [woItems, soItems] = await Promise.all([
            // ⚡ Web Orders: use same resolution as ledger (direct + WebProduct)
            WebOrder.aggregate([
                {
                    $match: {
                        status: { $nin: ['cancelled', 'trash', 'failed', 'refunded'] },
                        $or: woMatchOr,
                        ...(globalStartDate ? { dateCreated: { $gte: globalStartDate } } : {}),
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        $or: innerMatchOr,
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
                        'lineItems._id': 1,
                        'lineItems.productId': 1,
                        'lineItems.variationId': 1,
                        'lineItems.linkedSkuId': 1,
                        'lineItems.linkedSkus': 1,
                        'lineItems.lotNumber': 1,
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
                            { 'lineItems.lotNumber': '-' },
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
        const seen = new Set<string>(); // deduplicate

        for (const wo of woItems) {
            const line = wo.lineItems;
            const dedupeKey = `${wo._id}_${line.id || line._id}_${skuId}`;
            if (seen.has(dedupeKey)) continue;

            // Determine how this line item matches the SKU
            const isDirectMatch = line.linkedSkuId === skuId;
            const linkedSkuMatch = line.linkedSkus?.find((ls: any) => ls.skuId === skuId);

            // WebProduct resolution
            const wpKey = `${wo.website}-${line.productId}`;
            const wpMap = wpMultiplierMap.get(wpKey);
            let wpResolvedMultiplier: number | null = null;
            if (wpMap) {
                if (line.variationId && wpMap.has(line.variationId)) {
                    wpResolvedMultiplier = wpMap.get(line.variationId)!;
                } else if (wpMap.has('simple')) {
                    wpResolvedMultiplier = wpMap.get('simple')!;
                }
            }

            if (!isDirectMatch && !linkedSkuMatch && wpResolvedMultiplier === null) continue;

            // Determine lot number for THIS specific SKU
            const lot = linkedSkuMatch
                ? (linkedSkuMatch.lotNumber || '')
                : (isDirectMatch
                    ? (line.lotNumber || '')
                    : (line.lotNumber || '')); // WP-resolved: lot saved to line.lotNumber by transaction-update

            // Only include if lot is missing
            const isMissing = !lot || lot === '' || lot === '-' || lot === 'Allocated';
            if (!isMissing) continue;

            seen.add(dedupeKey);

            const multiplier = linkedSkuMatch ? (linkedSkuMatch.multiplier || 1)
                : (wpResolvedMultiplier !== null ? wpResolvedMultiplier : 1);

            const source = linkedSkuMatch ? 'Web Order (Bundle)'
                : (wpResolvedMultiplier !== null ? 'Web Order' : 'Web Order');

            items.push({
                id: `WO_${wo._id}_${line.id || line._id}`,
                source,
                orderId: wo._id,
                lineItemId: line.id || line._id,
                orderNumber: wo.number || wo._id,
                website: wo.website || '',
                status: wo.status || '',
                date: wo.dateCreated || '',
                quantity: (line.quantity || 0) * multiplier,
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
