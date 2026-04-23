import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import WebOrder from '@/models/WebOrder';
import Setting from '@/models/Setting';
import { buildFuzzySearchQuery } from '@/lib/fuzzy-search';

/**
 * FIELD-NAME PARITY:
 * The frontend expects the following exact field shapes on the response:
 * 
 * {
 *   "webProducts": Array<{
 *       _id: string,
 *       webId: string | number,
 *       website: string,
 *       name: string,
 *       sku_code?: string,
 *       type: string,
 *       totalWebOrders: number,
 *       isArchived?: boolean,
 *       linkedSkuId?: string | null,
 *       variations?: Array<{
 *           id?: string | number,
 *           _id?: string | number,
 *           name: string,
 *           linkedSkuId?: string | null,
 *           totalWebOrders: number
 *       }>
 *       // ... plus any other DB fields preserved by .lean()
 *   }>,
 *   "total": number,
 *   "page": number,
 *   "totalPages": number,
 *   "linkStats": {
 *       "totalLinkable": number,
 *       "totalLinked": number
 *   }
 * }
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const wpRouteTotalStart = Date.now();
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limitParam = searchParams.get('limit');
        const limit = limitParam === '0' ? 0 : parseInt(limitParam || '20');
        const sortBy = searchParams.get('sortBy') || 'totalWebOrders';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
        const search = searchParams.get('search') || '';
        const website = searchParams.get('website');
        const hideZeroOrders = searchParams.get('hideZeroOrders') === 'true';
        const showArchived = searchParams.get('showArchived') === 'true';

        let query: any = {};

        if (showArchived) {
            query.isArchived = true;
        } else {
            query.isArchived = { $ne: true };
        }

        if (search) {
            const fuzzyQuery = buildFuzzySearchQuery(search, ['name', 'variations.name', '_id', 'sku_code']);
            if (fuzzyQuery) Object.assign(query, fuzzyQuery);
        }

        if (website) {
            query.website = { $in: website.split(',') };
        }

        const wpSettingStart = Date.now();
        const dateFilterSetting = await Setting.findOne({ key: 'filterDataFrom' }).lean();
        console.log(`[wp-setting] ${Date.now() - wpSettingStart}ms`);
        const filterDate = dateFilterSetting?.value ? new Date(dateFilterSetting.value) : null;

        // Phase 0: lightweight product reference list — only webId+website, one small query
        const tRef = Date.now();
        const productRefs = await WebProduct.find(query, { webId: 1, website: 1, _id: 1 }).lean();
        console.log(`[wp-refs] ${Date.now() - tRef}ms`);

        const validWebIds = [...new Set(productRefs.map((p: any) => p.webId).filter(Boolean))];
        const validWebsites = [...new Set(productRefs.map((p: any) => p.website).filter(Boolean))];

        // PHASE 1 — Aggregate counts from WebOrder ONCE
        const wpCountsStart = Date.now();
        const countPipeline: any[] = [];
        countPipeline.push({
            $match: {
                website: { $in: validWebsites },
                "lineItems.productId": { $in: validWebIds },
                ...(filterDate ? { dateCreated: { $gte: filterDate } } : {})
            }
        });
        countPipeline.push(
            { $unwind: "$lineItems" },
            { $group: {
                _id: {
                    website: "$website",
                    productId: "$lineItems.productId",
                    variationId: { $ifNull: ["$lineItems.variationId", null] }
                },
                orderIds: { $addToSet: "$_id" }
            }},
            { $project: { count: { $size: "$orderIds" } } }
        );
        const rawCounts = await WebOrder.aggregate(countPipeline);
        console.log(`[wp-counts] ${Date.now() - wpCountsStart}ms`);

        // PHASE 2 — Build in-memory maps
        const productTotalMap = new Map<string, number>();
        const variationCountMap = new Map<string, number>();

        for (const row of rawCounts) {
            const { website, productId, variationId } = row._id;
            const count = row.count;

            if (!website || !productId) continue;

            const prodKey = `${website}::${productId}`;
            const currentTotal = productTotalMap.get(prodKey) || 0;
            productTotalMap.set(prodKey, currentTotal + count);

            if (variationId != null && variationId !== 0) {
                const varKey = `${website}::${productId}::${variationId}`;
                variationCountMap.set(varKey, count);
            }
        }

        // PHASE 3 — Decide the product-fetch strategy
        const wpProductsStart = Date.now();
        const isCaseA = sortBy === 'totalWebOrders' && (!!filterDate || hideZeroOrders);
        
        const projection = {
            _id: 1, webId: 1, website: 1, name: 1, sku_code: 1, type: 1,
            isArchived: 1, linkedSkuId: 1, totalWebOrders: 1,
            image: 1, platform: 1, salePrice: 1, multiplier: 1, linkedSkus: 1,
            'variations.id': 1, 'variations._id': 1, 'variations.name': 1,
            'variations.linkedSkuId': 1, 'variations.totalWebOrders': 1,
            'variations.image': 1, 'variations.price': 1, 'variations.salePrice': 1,
            'variations.multiplier': 1, 'variations.linkedSkus': 1
        };

        let finalProducts: any[] = [];
        let total = 0;

        if (isCaseA) {
            // Build tuples by enriching productRefs with counts
            const enriched = productRefs.map((ref: any) => ({
                _id: ref._id,
                webId: ref.webId,
                website: ref.website,
                total: productTotalMap.get(`${ref.website}::${ref.webId}`) || 0
            }));

            const visible = hideZeroOrders ? enriched.filter((e: any) => e.total > 0) : enriched;
            visible.sort((a: any, b: any) => sortOrder === 1 ? a.total - b.total : b.total - a.total);
            total = visible.length;

            const sliced = limit > 0 ? visible.slice((page - 1) * limit, (page - 1) * limit + limit) : visible;
            const ids = sliced.map((s: any) => s._id);

            if (ids.length > 0) {
                // Fast _id lookup — index on _id is automatic
                finalProducts = await WebProduct.find({ _id: { $in: ids } }, projection).lean();

                const tupleOrderMap = new Map();
                ids.forEach((id: string, i: number) => tupleOrderMap.set(String(id), i));

                finalProducts.sort((a: any, b: any) => {
                    const indexA = tupleOrderMap.get(String(a._id));
                    const indexB = tupleOrderMap.get(String(b._id));
                    return (indexA ?? 999999) - (indexB ?? 999999);
                });
            }
        } else {
            if (hideZeroOrders && !filterDate) {
                query.totalWebOrders = { $gt: 0 };
            }
            
            const queryObj = WebProduct.find(query, projection).sort({ [sortBy]: sortOrder });
            if (limit > 0) {
                queryObj.skip((page - 1) * limit).limit(limit);
            }
            
            const [dbTotal, fetchedProducts] = await Promise.all([
                WebProduct.countDocuments(query),
                queryObj.lean()
            ]);
            total = dbTotal;
            finalProducts = fetchedProducts as any[];
        }
        console.log(`[wp-products] ${Date.now() - wpProductsStart}ms`);

        // PHASE 4 — Overlay per-variation counts
        for (const p of finalProducts) {
            if (filterDate) {
                p.totalWebOrders = productTotalMap.get(`${p.website}::${p.webId}`) || 0;
            }
            
            if (p.variations && Array.isArray(p.variations)) {
                for (const v of p.variations) {
                    const vid = v.id || v._id;
                    v.totalWebOrders = variationCountMap.get(`${p.website}::${p.webId}::${vid}`) || 0;
                }
            }
        }

        // PHASE 5 — Keep the existing linkStatsResult aggregation exactly as-is
        const wpLinkstatsStart = Date.now();
        const linkStatsResult = await WebProduct.aggregate([
            { $match: query },
            {
                $facet: {
                    simple: [
                        { $match: { type: { $ne: 'variable' } } },
                        {
                            $group: {
                                _id: null,
                                totalLinkable: { $sum: 1 },
                                totalLinked: {
                                    $sum: { $cond: [{ $and: [{ $ne: ['$linkedSkuId', null] }, { $ne: ['$linkedSkuId', ''] }] }, 1, 0] }
                                }
                            }
                        }
                    ],
                    variable: [
                        { $match: { type: 'variable', 'variations.0': { $exists: true } } },
                        { $unwind: '$variations' },
                        {
                            $group: {
                                _id: null,
                                totalLinkable: { $sum: 1 },
                                totalLinked: {
                                    $sum: { $cond: [{ $and: [{ $ne: ['$variations.linkedSkuId', null] }, { $ne: ['$variations.linkedSkuId', ''] }] }, 1, 0] }
                                }
                            }
                        }
                    ]
                }
            }
        ]);

        const simpleStats = linkStatsResult[0]?.simple[0] || { totalLinkable: 0, totalLinked: 0 };
        const variableStats = linkStatsResult[0]?.variable[0] || { totalLinkable: 0, totalLinked: 0 };
        const globalLinkStats = {
            totalLinkable: simpleStats.totalLinkable + variableStats.totalLinkable,
            totalLinked: simpleStats.totalLinked + variableStats.totalLinked,
        };
        console.log(`[wp-linkstats] ${Date.now() - wpLinkstatsStart}ms`);

        console.log(`[wp-route-total] ${Date.now() - wpRouteTotalStart}ms`);
        return NextResponse.json({
            webProducts: finalProducts,
            total,
            page,
            totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
            linkStats: globalLinkStats
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();

        if (!body._id && body.webId && body.website) {
            body._id = `WC-${body.website}-${body.webId}`;
        }

        const product = await WebProduct.create(body);
        return NextResponse.json(product);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
