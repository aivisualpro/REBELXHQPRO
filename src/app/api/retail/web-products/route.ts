import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import WebOrder from '@/models/WebOrder';
import Setting from '@/models/Setting';

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

        let query: any = {};

        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { _id: { $regex: escapedSearch, $options: 'i' } },
                { sku_code: { $regex: escapedSearch, $options: 'i' } } // Added SKU search too
            ];
        }

        if (website) {
            query.website = { $in: website.split(',') };
        }

        const queryObj = WebProduct.find(query).sort({ [sortBy]: sortOrder });

        if (limit > 0) {
            queryObj.skip((page - 1) * limit).limit(limit);
        }

        const [total, webProducts] = await Promise.all([
            WebProduct.countDocuments(query),
            queryObj.lean()
        ]);

        // Check for Global Date Filter
        const dateFilterSetting = await Setting.findOne({ key: 'filterDataFrom' }).lean();
        
        if (dateFilterSetting?.value) {
            const filterDate = new Date(dateFilterSetting.value);
            
            // Calculate dynamic counts for the fetched products
            // Optimization: Only aggregate for the products on this page
            const productIdentifiers = webProducts.map((p: any) => ({ 
                webId: p.webId, 
                website: p.website 
            }));

            // We need to count orders for each product, respecting the date filter
            // This aggregation is slightly complex because one order can contain multiple products
            const counts = await WebOrder.aggregate([
                { 
                    $match: { 
                        dateCreated: { $gte: filterDate },
                        // Optimization: Only look at orders that might contain our products
                        // We can't easily filter by specific (webId+website) pairs in match without $expr or huge $or
                        // But we can limit by productId list at least?
                        'lineItems.productId': { $in: productIdentifiers.map((p: any) => p.webId) }
                    } 
                },
                { $unwind: '$lineItems' },
                { 
                    $match: { 
                        // Ensure we are counting distinct Order+Product pairs correctly
                         'lineItems.productId': { $in: productIdentifiers.map((p: any) => p.webId) }
                    } 
                },
                {
                    $group: {
                        _id: { 
                            webId: '$lineItems.productId',
                            // Try to group by website too if line item has it, or rely on Order website
                            website: '$website' 
                        },
                        // We want unique order count. Since we unwound AND grouped, each doc is a line item.
                        // But an order might have 2 line items of same product (rare but possible).
                        // count: { $sum: 1 } counts occurrences. 
                        // We want distinct orders. But we unwound from a unique order.
                        // So counting using $addToSet: "$_id" (Order ID) is safest if we didn't unwind?
                        // Actually, if we unwind, we are splitting order. 
                        orderIds: { $addToSet: "$_id" } // Collect unique order IDs
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

            // Create a variation-level lookup map: "website-webId-variationId" => count
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

        // === Global Link Stats (across all matching products, not just current page) ===
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

        return NextResponse.json({
            webProducts,
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
