import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import WebOrder from '@/models/WebOrder';
import Setting from '@/models/Setting';
import { buildFuzzySearchQuery } from '@/lib/fuzzy-search';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
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

        // When hideZeroOrders is true, we need to filter AFTER dynamic count recalculation
        // (because the date filter can change counts). So we fetch all and paginate manually.
        // When hideZeroOrders is false, use normal DB-level pagination.
        const useManualPagination = hideZeroOrders;

        const queryObj = WebProduct.find(query).sort({ [sortBy]: sortOrder });

        if (!useManualPagination && limit > 0) {
            queryObj.skip((page - 1) * limit).limit(limit);
        }

        const [dbTotal, webProducts] = await Promise.all([
            useManualPagination ? Promise.resolve(0) : WebProduct.countDocuments(query),
            queryObj.lean()
        ]);

        // Check for Global Date Filter
        const dateFilterSetting = await Setting.findOne({ key: 'filterDataFrom' }).lean();

        if (dateFilterSetting?.value) {
            const filterDate = new Date(dateFilterSetting.value);

            // Calculate dynamic counts for the fetched products
            const productIdentifiers = webProducts.map((p: any) => ({
                webId: p.webId,
                website: p.website
            }));

            const counts = await WebOrder.aggregate([
                {
                    $match: {
                        dateCreated: { $gte: filterDate },
                        'lineItems.productId': { $in: productIdentifiers.map((p: any) => p.webId) }
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.productId': { $in: productIdentifiers.map((p: any) => p.webId) }
                    }
                },
                {
                    $group: {
                        _id: {
                            webId: '$lineItems.productId',
                            website: '$website'
                        },
                        orderIds: { $addToSet: "$_id" }
                    }
                },
                {
                    $project: {
                        count: { $size: "$orderIds" }
                    }
                }
            ]);

            // Create a lookup map
            const countMap = new Map();
            counts.forEach((c: any) => {
                const key = `${c._id.website}-${c._id.webId}`;
                countMap.set(key, c.count);
            });

            // === Per-Variation Order Counts ===
            const variationCounts = await WebOrder.aggregate([
                {
                    $match: {
                        dateCreated: { $gte: filterDate },
                        'lineItems.productId': { $in: productIdentifiers.map((p: any) => p.webId) }
                    }
                },
                { $unwind: '$lineItems' },
                {
                    $match: {
                        'lineItems.productId': { $in: productIdentifiers.map((p: any) => p.webId) },
                        'lineItems.variationId': { $exists: true, $nin: [null, 0] }
                    }
                },
                {
                    $group: {
                        _id: {
                            webId: '$lineItems.productId',
                            website: '$website',
                            variationId: '$lineItems.variationId'
                        },
                        orderIds: { $addToSet: "$_id" }
                    }
                },
                {
                    $project: {
                        count: { $size: "$orderIds" }
                    }
                }
            ]);

            // Create a variation-level lookup map
            const varCountMap = new Map();
            variationCounts.forEach((c: any) => {
                const key = `${c._id.website}-${c._id.webId}-${c._id.variationId}`;
                varCountMap.set(key, c.count);
            });

            // Update the webProducts array with dynamic counts
            webProducts.forEach((p: any) => {
                const key = `${p.website}-${p.webId}`;
                if (countMap.has(key)) {
                    p.totalWebOrders = countMap.get(key);
                } else {
                    p.totalWebOrders = 0;
                }

                // Map variation-level counts
                if (p.variations && p.variations.length > 0) {
                    p.variations.forEach((v: any) => {
                        const vid = v.id || v._id;
                        const vKey = `${p.website}-${p.webId}-${vid}`;
                        v.totalWebOrders = varCountMap.get(vKey) || 0;
                    });
                }
            });
        }

        // Apply hideZeroOrders filter AFTER dynamic recalculation
        let finalProducts = webProducts;
        let total = dbTotal;

        if (hideZeroOrders) {
            finalProducts = webProducts.filter((p: any) => p.totalWebOrders && p.totalWebOrders > 0);
            total = finalProducts.length;
            // Manual pagination
            if (limit > 0) {
                const start = (page - 1) * limit;
                finalProducts = finalProducts.slice(start, start + limit);
            }
        }

        // === Global Link Stats ===
        let globalLinkStats = { totalLinkable: 0, totalLinked: 0 };

        if (hideZeroOrders) {
            // Compute from the already-filtered products (before pagination slice)
            const filteredAll = webProducts.filter((p: any) => p.totalWebOrders && p.totalWebOrders > 0);
            let totalLinkable = 0;
            let totalLinked = 0;
            filteredAll.forEach((p: any) => {
                if (p.type === 'variable' && p.variations && p.variations.length > 0) {
                    p.variations.forEach((v: any) => {
                        totalLinkable++;
                        if (v.linkedSkuId) totalLinked++;
                    });
                } else {
                    totalLinkable++;
                    if (p.linkedSkuId) totalLinked++;
                }
            });
            globalLinkStats = { totalLinkable, totalLinked };
        } else {
            // Use DB aggregation for unfiltered view
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
            globalLinkStats = {
                totalLinkable: simpleStats.totalLinkable + variableStats.totalLinkable,
                totalLinked: simpleStats.totalLinked + variableStats.totalLinked,
            };
        }

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

        // Ensure _id is set if not provided (usually WC-Website-ID)
        if (!body._id && body.webId && body.website) {
            body._id = `WC-${body.website}-${body.webId}`;
        }

        const product = await WebProduct.create(body);
        return NextResponse.json(product);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
