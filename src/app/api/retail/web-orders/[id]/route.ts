import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
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
        
        // Collect SKU IDs that look like ObjectIds
        const skuIds = order.lineItems
            .map((item: any) => item.sku)
            .filter((sku: any) => typeof sku === 'string' && sku.length > 0);
        
        if (skuIds.length > 0) {
            const skus = await Sku.find({ _id: { $in: skuIds } }).select('name uom').lean();
            const skuMap = new Map(skus.map((s: any) => [s._id.toString(), s]));

            order.lineItems = order.lineItems.map((item: any) => {
                if (typeof item.sku === 'string' && skuMap.has(item.sku)) {
                    // Keep sku as string, add skuDetails for extra info
                    return { ...item, skuDetails: skuMap.get(item.sku) };
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
