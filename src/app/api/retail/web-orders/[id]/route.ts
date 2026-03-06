import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import WebProduct from '@/models/WebProduct';
import Sku from '@/models/Sku';
import { getLotsWithCost } from '@/lib/lot-cost';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        // Ensure models are registered
        void Sku;

        const params = await props.params;
        const { id } = params;

        const order = await WebOrder.findById(id).lean() as any;

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

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

        // Resolve variation names and multipliers from WebProduct
        const webProductIds = [...new Set(
            order.lineItems
                .map((item: any) => item.webProductId || item.parentProductId)
                .filter(Boolean)
        )];

        const multiplierMap = new Map<string, number>();

        if (webProductIds.length > 0) {
            const webProducts = await WebProduct.find({ _id: { $in: webProductIds } })
                .select('variations multiplier')
                .lean();
            const wpMap = new Map(webProducts.map((wp: any) => [wp._id.toString(), wp]));

            order.lineItems = order.lineItems.map((item: any) => {
                const wpId = item.webProductId || item.parentProductId;
                if (wpId) {
                    const wp = wpMap.get(wpId.toString());
                    if (wp) {
                        let multiplier = wp.multiplier ?? 1;
                        if (item.variationId && wp.variations) {
                            const variation = wp.variations.find(
                                (v: any) => v.id == item.variationId || v._id == item.variationId
                            );
                            if (variation) {
                                if (variation.name) item = { ...item, variationName: variation.name };
                                if (variation.multiplier != null) multiplier = variation.multiplier;
                            }
                        }
                        multiplierMap.set(String(item.id), multiplier);
                        return item;
                    }
                }
                return item;
            });
        }

        // ─── VIRTUAL COST CALCULATION ─────────────────────────────────────
        // Uses getLotsWithCost() which derives costs from the SKU ledger —
        // the same source used by the Lot Selection Modal.
        // This handles all cost sources including manufactured items where
        // totalCost is calculated from ingredients + labor + packaging.

        // Collect unique linkedSkuIds that need cost lookup
        const skuIdsForCost = [...new Set(
            order.lineItems
                .filter((item: any) => item.linkedSkuId && item.lotNumber)
                .map((item: any) => item.linkedSkuId)
        )] as string[];

        // Fetch lot costs for all unique SKUs in parallel
        const lotCostBySkuId = new Map<string, Map<string, number>>();
        if (skuIdsForCost.length > 0) {
            const costResults = await Promise.all(
                skuIdsForCost.map(sid => getLotsWithCost(sid))
            );
            skuIdsForCost.forEach((sid, idx) => {
                lotCostBySkuId.set(sid, costResults[idx]);
            });
        }

        // Apply virtual costs to line items
        order.lineItems = order.lineItems.map((item: any) => {
            if (item.linkedSkuId && item.lotNumber) {
                const skuLots = lotCostBySkuId.get(item.linkedSkuId);
                const baseCost = skuLots?.get(item.lotNumber) || 0;
                const multiplier = multiplierMap.get(String(item.id)) || 1;
                return { ...item, cost: baseCost * multiplier };
            }
            return { ...item, cost: item.cost || 0 };
        });

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
