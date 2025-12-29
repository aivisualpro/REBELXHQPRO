import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import Setting from '@/models/Setting';
import WebProduct from '@/models/WebProduct';
import { getSuggestedLotForSku } from '@/lib/lot-helpers';

export const dynamic = 'force-dynamic';

// Cache for suggested lots per SKU (to avoid repeated DB queries within same request)
const lotCache = new Map<string, { lotNumber: string; cost: number } | null>();

// Get suggested lot for a SKU (uses robust helper that includes ALL transaction types)
async function getSuggestedLot(skuId: string): Promise<{ lotNumber: string; cost: number } | null> {
    if (!skuId) return null;
    
    // Check cache first
    if (lotCache.has(skuId)) {
        return lotCache.get(skuId) || null;
    }
    
    // Use the robust lot helper that includes all sources AND consumptions
    const suggested = await getSuggestedLotForSku(skuId);
    const result = suggested ? { lotNumber: suggested.lotNumber, cost: suggested.cost } : null;
    lotCache.set(skuId, result);
    return result;
}


export async function GET(request: Request) {
    try {
        // Clear cache at start of request
        lotCache.clear();
        
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
                // Determine the linkedSkuId from item or fallback to webProduct
                let effectiveLinkedSkuId = item.linkedSkuId;
                let effectiveLotNumber = item.lotNumber;
                let effectiveCost = item.cost;

                if (!effectiveLinkedSkuId && webProduct) {
                    if (item.variationId) {
                        const variation = webProduct.variations?.find((v: any) => v.id == item.variationId || v._id == item.variationId);
                        if (variation) {
                            effectiveLinkedSkuId = variation.linkedSkuId;
                        }
                    } else {
                        effectiveLinkedSkuId = webProduct.linkedSkuId;
                    }
                }
                
                // If we have a linkedSkuId but no lot number, dynamically suggest one
                if (effectiveLinkedSkuId && !effectiveLotNumber) {
                    const suggestedLot = await getSuggestedLot(effectiveLinkedSkuId);
                    if (suggestedLot) {
                        effectiveLotNumber = suggestedLot.lotNumber;
                        effectiveCost = suggestedLot.cost;
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
                    // Enrichment fields with dynamic fallbacks and lot suggestion
                    linkedSkuId: effectiveLinkedSkuId || null,
                    lotNumber: effectiveLotNumber || null,
                    cost: effectiveCost || null,
                    // Flag to indicate if lot is suggested (not saved to DB yet)
                    lotIsSuggested: !item.lotNumber && effectiveLotNumber ? true : false
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

