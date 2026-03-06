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
        const { lineItemId, skuIndex, lotNumber, cost, variationId, variationName } = body;

        if (lineItemId === undefined) {
            return NextResponse.json({ error: 'lineItemId is required' }, { status: 400 });
        }

        const order = await WebOrder.findById(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Find the line item by id (WooCommerce line item id)
        const lineItemIdx = order.lineItems.findIndex((li: any) =>
            li.id === lineItemId || li._id?.toString() === String(lineItemId)
        );

        if (lineItemIdx === -1) {
            return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
        }

        const lineItem = order.lineItems[lineItemIdx];

        // ─── Variation update: set variationId and resolve linked SKUs ────
        if (variationId !== undefined) {
            order.set(`lineItems.${lineItemIdx}.variationId`, variationId);
            if (variationName) {
                order.set(`lineItems.${lineItemIdx}.variationName`, variationName);
            }

            // Re-resolve linked SKUs from the variation on the WebProduct
            const webProductId = lineItem.webProductId || lineItem.parentProductId;
            if (webProductId && variationId) {
                try {
                    const wp = await WebProduct.findById(webProductId).lean() as any;
                    if (wp?.variations) {
                        const variation = wp.variations.find(
                            (v: any) => v.id == variationId || v._id == String(variationId)
                        );
                        if (variation) {
                            // Get linked SKUs from the variation
                            const linkedSkus = variation.linkedSkus?.length > 0
                                ? variation.linkedSkus
                                : variation.linkedSkuId
                                    ? [{ skuId: variation.linkedSkuId, multiplier: variation.multiplier || 1 }]
                                    : [];

                            if (linkedSkus.length > 0) {
                                const newLinkedSkus = linkedSkus.map((ls: any) => ({
                                    skuId: ls.skuId,
                                    multiplier: ls.multiplier || 1,
                                    lotNumber: null,
                                    cost: 0,
                                }));
                                order.set(`lineItems.${lineItemIdx}.linkedSkus`, newLinkedSkus);
                                order.set(`lineItems.${lineItemIdx}.linkedSkuId`, linkedSkus[0]?.skuId || null);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error resolving variation linked SKUs:', e);
                }
            }

            order.updatedAt = new Date();
            await order.save();

            return NextResponse.json({
                success: true,
                lineItemId,
                variationId,
                variationName,
                message: `Variation updated to ${variationName || variationId}`,
            });
        }

        // ─── Multi-SKU: update specific linkedSkus entry ─────────────────
        if (skuIndex != null && lineItem.linkedSkus && lineItem.linkedSkus[skuIndex]) {
            const entry = lineItem.linkedSkus[skuIndex];
            const skuId = entry.skuId;

            // Calculate cost from lot
            let finalCost = cost;
            if (skuId && lotNumber && (cost === undefined || cost === null)) {
                const lotCosts = await getLotsWithCost(skuId);
                const baseCost = lotCosts.get(lotNumber) || 0;
                finalCost = baseCost * (entry.multiplier || 1);
            }

            // Use set() with explicit path for reliable Mongoose persistence
            order.set(`lineItems.${lineItemIdx}.linkedSkus.${skuIndex}.lotNumber`, lotNumber || null);
            order.set(`lineItems.${lineItemIdx}.linkedSkus.${skuIndex}.cost`, finalCost || 0);

            // Also keep legacy fields in sync with the first entry
            if (skuIndex === 0) {
                order.set(`lineItems.${lineItemIdx}.lotNumber`, lotNumber || null);
                order.set(`lineItems.${lineItemIdx}.cost`, finalCost || 0);
            }

            order.updatedAt = new Date();
            await order.save();

            return NextResponse.json({
                success: true,
                lineItemId,
                skuIndex,
                lotNumber: lotNumber || null,
                cost: finalCost || 0,
                message: lotNumber
                    ? `Updated lot to ${lotNumber}${finalCost > 0 ? ` (cost: $${finalCost.toFixed(2)})` : ''}`
                    : 'Lot cleared'
            });
        }

        // ─── Legacy: single linkedSkuId lot update ───────────────────────
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
