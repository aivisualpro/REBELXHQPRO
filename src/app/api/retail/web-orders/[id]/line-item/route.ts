import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';

export const dynamic = 'force-dynamic';

// Get cost for a specific lot
async function getLotCost(skuId: string, lotNumber: string): Promise<number> {
    if (!lotNumber) return 0;
    
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
        return 0; // Will be calculated by ledger
    }

    // Check Audit Adjustments
    const adj = await AuditAdjustment.findOne({ sku: skuId, lotNumber }).lean();
    if (adj?.cost) return adj.cost;

    return 0;
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();
        const { lineItemId, lotNumber, cost } = body;

        if (lineItemId === undefined) {
            return NextResponse.json({ error: 'lineItemId is required' }, { status: 400 });
        }

        const order = await WebOrder.findById(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Find the line item by id (WooCommerce line item id)
        const lineItem = order.lineItems.find((li: any) => 
            li.id === lineItemId || li._id?.toString() === String(lineItemId)
        );

        if (!lineItem) {
            return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
        }

        // Determine the cost - use provided cost or calculate it
        let finalCost = cost;
        if (lineItem.linkedSkuId && lotNumber && (cost === undefined || cost === null)) {
            finalCost = await getLotCost(lineItem.linkedSkuId, lotNumber);
        }

        // Update the line item
        lineItem.lotNumber = lotNumber || null;
        lineItem.cost = finalCost || 0;
        order.updatedAt = new Date();
        await order.save();

        return NextResponse.json({
            success: true,
            lineItemId,
            lotNumber: lotNumber || null,
            cost: finalCost || 0,
            message: lotNumber 
                ? `Updated lot to ${lotNumber}${finalCost > 0 ? ` (cost: $${finalCost.toFixed(2)})` : ''}`
                : 'Lot cleared'
        });

    } catch (error: any) {
        console.error('Update line item error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
