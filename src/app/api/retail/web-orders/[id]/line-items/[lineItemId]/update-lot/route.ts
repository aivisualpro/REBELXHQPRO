import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebProduct from '@/models/WebProduct';

export const dynamic = 'force-dynamic';

// Get cost for a specific lot
async function getLotCost(skuId: string, lotNumber: string): Promise<number> {
    // Check Opening Balance
    const ob = await OpeningBalance.findOne({ sku: skuId, lotNumber }).lean();
    if (ob?.cost) return ob.cost;

    // Check Purchase Orders
    const po = await PurchaseOrder.findOne({ 
        'lineItems.sku': skuId, 
        'lineItems.lotNumber': lotNumber 
    }).lean();
    if (po) {
        const li = po.lineItems.find((l: any) => 
            l.sku?.toString() === skuId && l.lotNumber === lotNumber
        );
        if (li?.cost) return li.cost;
    }

    // Check Manufacturing
    const mo = await Manufacturing.findOne({ 
        sku: skuId, 
        $or: [{ lotNumber }, { label: lotNumber }]
    }).lean();
    if (mo) {
        // Calculate COGM (simplified - full logic in ledger route)
        return 0; // Will be calculated by ledger
    }

    // Check Audit Adjustments
    const adj = await AuditAdjustment.findOne({ sku: skuId, lotNumber }).lean();
    if (adj?.cost) return adj.cost;

    return 0;
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string; lineItemId: string }> }
) {
    try {
        await dbConnect();
        const { id, lineItemId } = await context.params;
        const body = await request.json();
        const { lotNumber } = body;

        if (!lotNumber) {
            return NextResponse.json({ error: 'lotNumber is required' }, { status: 400 });
        }

        const order = await WebOrder.findById(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Find the line item
        const lineItem = order.lineItems.find((li: any) => 
            li._id?.toString() === lineItemId || li.id?.toString() === lineItemId
        );

        if (!lineItem) {
            return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
        }

        if (!lineItem.linkedSkuId) {
            // Dynamic Fallback: Check if the SKU is linked at the product/variation level
            const webProduct = await WebProduct.findOne({ 
                $or: [
                    { webId: lineItem.productId, website: order.website },
                    { _id: `WC-${order.website}-${lineItem.productId}` }
                ]
            }).lean();

            if (webProduct) {
                let skuFromProduct = null;
                if (lineItem.variationId) {
                    const variation = (webProduct as any).variations?.find((v: any) => v.id == lineItem.variationId || v._id == lineItem.variationId);
                    skuFromProduct = variation?.linkedSkuId;
                } else {
                    skuFromProduct = (webProduct as any).linkedSkuId;
                }

                if (skuFromProduct) {
                    lineItem.linkedSkuId = skuFromProduct;
                    lineItem.webProductId = webProduct._id;
                    // We'll proceed with this SKU
                }
            }
        }

        if (!lineItem.linkedSkuId) {
            return NextResponse.json({ 
                error: 'Line item has no linked SKU. Link a SKU first.' 
            }, { status: 400 });
        }

        // Get cost for the new lot
        const cost = await getLotCost(lineItem.linkedSkuId, lotNumber);

        // Update the line item
        lineItem.lotNumber = lotNumber;
        lineItem.cost = cost;
        order.updatedAt = new Date();
        await order.save();

        return NextResponse.json({
            success: true,
            lineItemId,
            lotNumber,
            cost,
            message: `Updated lot to ${lotNumber}${cost > 0 ? ` (cost: $${cost.toFixed(2)})` : ''}`
        });

    } catch (error: any) {
        console.error('Update lot error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
