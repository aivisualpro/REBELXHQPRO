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

            // Update the webProducts array with dynamic counts
            webProducts.forEach((p: any) => {
                const key = `${p.website}-${p.webId}`;
                if (countMap.has(key)) {
                    p.totalWebOrders = countMap.get(key);
                } else {
                    p.totalWebOrders = 0; // If no orders found in date range, count is 0
                }
            });
        }

        return NextResponse.json({
            webProducts,
            total,
            page,
            totalPages: limit > 0 ? Math.ceil(total / limit) : 1
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
