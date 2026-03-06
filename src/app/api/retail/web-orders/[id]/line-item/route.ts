import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import WebProduct from '@/models/WebProduct';
import { getLotsWithCost } from '@/lib/lot-cost';

export const dynamic = 'force-dynamic';

// Get multiplier from the linked WebProduct (variation or simple product)
async function getMultiplier(lineItem: any): Promise<number> {
    const webProductId = lineItem.webProductId || lineItem.parentProductId;
    if (!webProductId) return 1;

    try {
        const product = await WebProduct.findById(webProductId).lean() as any;
        if (!product) return 1;

        // For variable products, check the matching variation
        if (lineItem.variationId && product.variations?.length > 0) {
            const variation = product.variations.find(
                (v: any) => v.id === lineItem.variationId
            );
            if (variation?.multiplier != null) return variation.multiplier;
        }

        // For simple products or fallback, use the product-level multiplier
        return product.multiplier ?? 1;
    } catch {
        return 1;
    }
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

        // Calculate cost using the lot-cost helper (same as ledger)
        let finalCost = cost;
        if (lineItem.linkedSkuId && lotNumber && (cost === undefined || cost === null)) {
            const lotCosts = await getLotsWithCost(lineItem.linkedSkuId);
            const baseCost = lotCosts.get(lotNumber) || 0;
            const multiplier = await getMultiplier(lineItem);
            finalCost = baseCost * multiplier;
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
