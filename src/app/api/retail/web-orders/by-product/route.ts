import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import Setting from '@/models/Setting';
import WebProduct from '@/models/WebProduct';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = parseInt(searchParams.get('productId') || '0');
        const website = searchParams.get('website') || '';

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        // Robust parsing for variationId
        const variationIdParam = searchParams.get('variationId');
        let variationId: any = 0;
        if (variationIdParam && variationIdParam !== 'null' && variationIdParam !== 'undefined') {
             const parsed = parseInt(variationIdParam);
             variationId = isNaN(parsed) ? variationIdParam : parsed;
        }

        if (!productId) {
            return NextResponse.json({ lineItems: [], totalOrders: 0, totalItems: 0 });
        }

        let query: any = {};

        // Apply Global Data Filter
        const dateFilterSetting = await Setting.findOne({ key: 'filterDataFrom' }).lean();
        if (dateFilterSetting?.value) {
            query.dateCreated = { $gte: new Date(dateFilterSetting.value) };
        }

        // If a variation ID is provided, we filter by it.
        if (variationId) {
            query.lineItems = {
                $elemMatch: {
                    productId: productId,
                    variationId: variationId
                }
            };
        } else {
            query['lineItems.productId'] = productId;
        }

        if (website) {
            query.website = website;
        }

        // Fetch the WebProduct for dynamic fallbacks - increase robustness
        const webProduct = await WebProduct.findOne({ 
            $or: [
                { webId: productId, website },
                { _id: `WC-${website}-${productId}` }
            ]
        }).lean();

        if (!webProduct) {
            console.log(`[by-product] WebProduct not found for webId: ${productId}, website: ${website}`);
        }

        const totalOrders = await WebOrder.countDocuments(query);
        const orders = await WebOrder.find(query)
            .sort({ dateCreated: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Extract line items that match the product ID
        const lineItems: any[] = [];
        
        for (const order of orders) {
            const matchingItems = (order.lineItems || []).filter(
                (item: any) => {
                    const pidMatch = item.productId == productId;
                    // If variationId is set, strict match. If not, catch all variations for this product.
                    const vidMatch = variationId ? item.variationId == variationId : true;
                    return pidMatch && vidMatch;
                }
            );
            
            for (const item of matchingItems) {
                // Determine the linkedSkuId and potential lot/cost from webProduct for fallback
                let effectiveLinkedSkuId = item.linkedSkuId;
                let effectiveLotNumber = item.lotNumber;
                let effectiveCost = item.cost;

                if (!effectiveLinkedSkuId && webProduct) {
                    if (item.variationId) {
                        const variation = webProduct.variations?.find((v: any) => v.id == item.variationId || v._id == item.variationId);
                        if (variation) {
                            effectiveLinkedSkuId = variation.linkedSkuId;
                            // Fallback for lot/cost from variation if not present on item
                            if (!effectiveLotNumber && variation.lotNumber) effectiveLotNumber = variation.lotNumber;
                            if (!effectiveCost && variation.cost) effectiveCost = variation.cost;
                        }
                    } else {
                        effectiveLinkedSkuId = webProduct.linkedSkuId;
                        // Fallback for lot/cost from main product if not present on item
                        if (!effectiveLotNumber && webProduct.lotNumber) effectiveLotNumber = webProduct.lotNumber;
                        if (!effectiveCost && webProduct.cost) effectiveCost = webProduct.cost;
                    }
                }

                lineItems.push({
                    _id: item._id || `${order._id}-${item.id}`,
                    lineItemId: item._id?.toString() || item.id?.toString(),
                    orderId: order._id,
                    orderNumber: order.number,
                    orderStatus: order.status,
                    orderDate: order.dateCreated,
                    customer: {
                        name: `${order.billing?.firstName || ''} ${order.billing?.lastName || ''}`.trim(),
                        email: order.billing?.email
                    },
                    website: order.website,
                    productName: item.name,
                    variationId: item.variationId,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.total,
                    sku: item.sku,
                    // NEW: Enrichment fields with dynamic fallbacks - Hardened lookup
                    linkedSkuId: effectiveLinkedSkuId || null,
                    lotNumber: effectiveLotNumber || null,
                    cost: effectiveCost || null
                });
            }
        }

        return NextResponse.json({ 
            lineItems,
            totalOrders: totalOrders,
            totalItems: lineItems.length
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
