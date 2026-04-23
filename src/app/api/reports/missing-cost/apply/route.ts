import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import SaleOrder from '@/models/SaleOrder';
import { getLotsWithCost } from '@/lib/lot-cost';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

// POST /api/reports/missing-cost/apply
// Applies lot-based costs to all line items that have a lotNumber but cost=0
export async function POST(request: NextRequest) {
    try {
        await dbConnect();

        const body = await request.json().catch(() => ({}));
        const { skuId } = body; // optional: if provided, only process that SKU

        const globalStartDate = await getGlobalStartDate();

        const INVALID_LOT_VALUES = [null, '', 'N/A', 'Allocated'];

        // ── Step 1: Find all Web Orders with missing costs ──
        const woMatch: any = {
            status: { $nin: ['cancelled', 'trash', 'failed', 'refunded'] },
            ...(globalStartDate ? { dateCreated: { $gte: globalStartDate } } : {}),
        };
        if (skuId) {
            woMatch['lineItems.linkedSkuId'] = skuId;
        } else {
            woMatch['lineItems.linkedSkuId'] = { $exists: true, $ne: null };
        }

        const soMatch: any = {
            status: { $nin: ['Cancelled', 'Voided'] },
            ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
        };
        if (skuId) {
            soMatch['lineItems.sku'] = skuId;
        } else {
            soMatch['lineItems.sku'] = { $exists: true, $ne: null };
        }

        const [webOrders, saleOrders] = await Promise.all([
            WebOrder.find(woMatch).lean() as any,
            SaleOrder.find(soMatch).lean() as any,
        ]);

        // ── Step 2: Collect all unique SKU IDs we need lot costs for ──
        const skuIdSet = new Set<string>();
        for (const wo of webOrders) {
            for (const li of (wo.lineItems || [])) {
                const needsCost =
                    li.lotNumber &&
                    !INVALID_LOT_VALUES.includes(li.lotNumber) &&
                    (!li.cost || li.cost === 0);
                if (needsCost && li.linkedSkuId) skuIdSet.add(li.linkedSkuId);
                if (li.linkedSkus?.length) {
                    for (const ls of li.linkedSkus) {
                        const lsNeedsCost = ls.lotNumber && !INVALID_LOT_VALUES.includes(ls.lotNumber) && (!ls.cost || ls.cost === 0);
                        if (lsNeedsCost && ls.skuId) skuIdSet.add(ls.skuId);
                    }
                }
            }
        }
        for (const so of saleOrders) {
            for (const li of (so.lineItems || [])) {
                const needsCost =
                    li.lotNumber &&
                    !INVALID_LOT_VALUES.includes(li.lotNumber) &&
                    (!li.cost || li.cost === 0);
                if (needsCost && li.sku) skuIdSet.add(li.sku);
            }
        }
        // ── Step 2: Fetch lot costs for this SKU ──
        const lotCosts = await getLotsWithCost(skuId);

        // ── Step 3: Apply costs to Web Orders ──
        let woUpdated = 0, woLineItemsFixed = 0;
        const resolvedOrderIds: string[] = [];

        const woBulk = WebOrder.collection.initializeUnorderedBulkOp();
        let woHasOps = false;

        for (const wo of webOrders) {
            let changed = false;
            const updates: Record<string, any> = {};

            for (let i = 0; i < (wo.lineItems || []).length; i++) {
                const li = wo.lineItems[i];

                // Legacy single-SKU path
                if (String(li.linkedSkuId) === skuId && li.lotNumber && !INVALID_LOT_VALUES.includes(li.lotNumber) && (!li.cost || li.cost === 0)) {
                    const cleanedLot = String(li.lotNumber).trim().replace(/,/g, '').replace(/\.0+$/, '');
                    const baseCost = lotCosts.get(cleanedLot) ?? lotCosts.get(li.lotNumber) ?? 0;
                    if (baseCost > 0) {
                        updates[`lineItems.${i}.cost`] = baseCost * (li.multiplier || 1);
                        changed = true; woLineItemsFixed++;
                    }
                }

                // Multi-SKU path
                if (li.linkedSkus?.length) {
                    for (let j = 0; j < li.linkedSkus.length; j++) {
                        const ls = li.linkedSkus[j];
                        if (String(ls.skuId) === skuId && ls.lotNumber && !INVALID_LOT_VALUES.includes(ls.lotNumber) && (!ls.cost || ls.cost === 0)) {
                            const cleanedLot = String(ls.lotNumber).trim().replace(/,/g, '').replace(/\.0+$/, '');
                            const baseCost = lotCosts.get(cleanedLot) ?? lotCosts.get(ls.lotNumber) ?? 0;
                            if (baseCost > 0) {
                                const finalCost = baseCost * (ls.multiplier || 1);
                                updates[`lineItems.${i}.linkedSkus.${j}.cost`] = finalCost;
                                if (j === 0) updates[`lineItems.${i}.cost`] = finalCost;
                                changed = true; woLineItemsFixed++;
                            }
                        }
                    }
                }
            }

            if (changed) {
                updates['updatedAt'] = new Date();
                woBulk.find({ _id: wo._id }).updateOne({ $set: updates });
                woHasOps = true; woUpdated++;
                resolvedOrderIds.push(String(wo._id));
            }
        }

        if (woHasOps) await woBulk.execute();

        // ── Step 4: Apply costs to Sale Orders ──
        let soUpdated = 0, soLineItemsFixed = 0;
        const soBulk = SaleOrder.collection.initializeUnorderedBulkOp();
        let soHasOps = false;

        for (const so of saleOrders) {
            let changed = false;
            const updates: Record<string, any> = {};

            for (let i = 0; i < (so.lineItems || []).length; i++) {
                const li = so.lineItems[i];
                if (String(li.sku) === skuId && li.lotNumber && !INVALID_LOT_VALUES.includes(li.lotNumber) && (!li.cost || li.cost === 0)) {
                    const cleanedLot = String(li.lotNumber).trim().replace(/,/g, '').replace(/\.0+$/, '');
                    const cost = lotCosts.get(cleanedLot) ?? lotCosts.get(li.lotNumber) ?? 0;
                    if (cost > 0) {
                        updates[`lineItems.${i}.cost`] = cost;
                        changed = true; soLineItemsFixed++;
                    }
                }
            }

            if (changed) {
                updates['updatedAt'] = new Date();
                soBulk.find({ _id: so._id }).updateOne({ $set: updates });
                soHasOps = true; soUpdated++;
                resolvedOrderIds.push(String(so._id));
            }
        }

        if (soHasOps) await soBulk.execute();

        return NextResponse.json({
            success: true,
            stats: {
                skusProcessed: 1,
                webOrdersUpdated: woUpdated,
                webLineItemsFixed: woLineItemsFixed,
                saleOrdersUpdated: soUpdated,
                saleLineItemsFixed: soLineItemsFixed,
                totalFixed: woLineItemsFixed + soLineItemsFixed,
            },
            resolvedOrderIds,
        });

    } catch (error: any) {
        console.error('Missing Cost apply error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
