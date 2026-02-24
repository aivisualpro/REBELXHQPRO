import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import WebProduct from '@/models/WebProduct';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        // Ensure models are registered
        void Sku; 

        // Await params for Next.js 15+
        const params = await props.params;
        const { id } = params;

        // Populate SKU details in lineItems
        const order = await WebOrder.findById(id).lean() as any;

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Manually populate SKUs if they are IDs, or leave as string if not found/raw
        // Since SKU in schema is Mixed, population might be tricky if it's not a valid ObjectId.
        // But let's try standard population or manual lookup if needed.
        // Actually, Mongoose populate works if the ref and type are set correctly.
        // In my schema: sku: { type: Schema.Types.Mixed, ref: 'Sku' }
        // Let's try to populate manually for robust handling since IDs might be strings or ObjectIds.
        
        // Collect all SKU IDs (both sku and linkedSkuId) for batch lookup
        const skuIds = order.lineItems
            .map((item: any) => item.sku)
            .filter((sku: any) => typeof sku === 'string' && sku.length > 0);
        
        const linkedSkuIds = order.lineItems
            .map((item: any) => item.linkedSkuId)
            .filter((id: any) => typeof id === 'string' && id.length > 0);
        
        const allSkuIds = [...new Set([...skuIds, ...linkedSkuIds])];
        
        if (allSkuIds.length > 0) {
            const skus = await Sku.find({ _id: { $in: allSkuIds } }).select('name uom').lean();
            const skuMap = new Map(skus.map((s: any) => [s._id.toString(), s]));

            order.lineItems = order.lineItems.map((item: any) => {
                const enriched = { ...item };
                if (typeof item.sku === 'string' && skuMap.has(item.sku)) {
                    enriched.skuDetails = skuMap.get(item.sku);
                }
                if (typeof item.linkedSkuId === 'string' && skuMap.has(item.linkedSkuId)) {
                    enriched.linkedSkuName = skuMap.get(item.linkedSkuId)?.name || item.linkedSkuId;
                }
                return enriched;
            });
        }

        // Resolve variation names from WebProduct
        const webProductIds = [...new Set(
            order.lineItems
                .map((item: any) => item.webProductId || item.parentProductId)
                .filter(Boolean)
        )];
        if (webProductIds.length > 0) {
            const webProducts = await WebProduct.find({ _id: { $in: webProductIds } }).select('variations').lean();
            const wpMap = new Map(webProducts.map((wp: any) => [wp._id.toString(), wp]));
            order.lineItems = order.lineItems.map((item: any) => {
                const wpId = item.webProductId || item.parentProductId;
                if (wpId && item.variationId) {
                    const wp = wpMap.get(wpId.toString());
                    if (wp?.variations) {
                        const variation = wp.variations.find((v: any) => v.id == item.variationId || v._id == item.variationId);
                        if (variation?.name) {
                            return { ...item, variationName: variation.name };
                        }
                    }
                }
                return item;
            });
        }

        // Enrich line items with cost based on Lot Number
        if (order.lineItems && Array.isArray(order.lineItems)) {
            const enrichedLineItems = await Promise.all(order.lineItems.map(async (item: any) => {
                let cost = 0;
                // item.sku is always a string (skuDetails has the populated object if any)
                const skuId = item.sku;
                const lotNumber = item.lotNumber;

                if (skuId && lotNumber) {
                    // 1. Check Opening Balance
                    const ob = await OpeningBalance.findOne({
                        sku: skuId,
                        lotNumber: lotNumber
                    }).select('cost').lean();

                    if (ob) {
                        cost = ob.cost || 0;
                    } else {
                        // 2. Check Purchase Orders
                        const po = await PurchaseOrder.findOne({
                            'lineItems': {
                                $elemMatch: {
                                    sku: skuId,
                                    lotNumber: lotNumber
                                }
                            }
                        }).select('lineItems').lean();

                        if (po && po.lineItems) {
                            const line = po.lineItems.find((l: any) => {
                                const lSku = l.sku?._id || l.sku;
                                return lSku?.toString() === skuId?.toString() && l.lotNumber === lotNumber;
                            });
                            if (line) {
                                cost = line.cost || 0;
                            }
                        }
                    }
                }
                return { ...item, cost };
            }));
            order.lineItems = enrichedLineItems;
        }

        return NextResponse.json(order);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const params = await props.params;
        const { id } = params;
        const body = await request.json();

        // Separate status update from line item updates usually, but here we just handle body
        const updatedOrder = await WebOrder.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true }
        ).lean();

        if (!updatedOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json(updatedOrder);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
