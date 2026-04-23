import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import SaleOrder from '@/models/SaleOrder';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import { getLotsWithCost, calculateJobCostPerUnit } from '@/lib/lot-cost';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

// POST /api/reports/missing-cost/apply
// Applies lot-based costs to all records that have a lotNumber but cost=0
// Covers: Web Orders, Sale Orders, Opening Balances, Purchase Orders,
//         Manufacturing (output), and Manufacturing Consumption (ingredients)
export async function POST(request: NextRequest) {
    try {
        await dbConnect();

        const body = await request.json().catch(() => ({}));
        const { skuId } = body; // required: which SKU to process

        if (!skuId) {
            return NextResponse.json({ error: 'skuId is required' }, { status: 400 });
        }

        const globalStartDate = await getGlobalStartDate();
        const INVALID_LOT_VALUES = [null, '', 'N/A', 'Allocated'];

        // ── Build ObjectId-aware SKU match ──
        const skuOid = skuId !== 'all' && mongoose.Types.ObjectId.isValid(skuId) ? new mongoose.Types.ObjectId(skuId) : skuId;
        const skuMatch = skuId === 'all' ? { $exists: true, $ne: null } : { $in: [skuOid, skuId] };

        // Helper to check if a field value matches our target skuId (handles ObjectId vs string)
        const matchesSku = (val: any) => {
            if (!val) return false;
            if (skuId === 'all') return true;
            return String(val) === skuId;
        };

        // ── Step 1: Fetch lot costs for this SKU ──
        const lotCosts = await getLotsWithCost(skuId);

        const resolvedOrderIds: string[] = [];
        let totalFixed = 0;

        // ── Step 2: Find all records across ALL sources ──
        const [webOrders, saleOrders, openingBalances, purchaseOrders, mfgOutputs, mfgConsumptions] = await Promise.all([
            // Web Orders
            WebOrder.find({
                status: { $nin: ['cancelled', 'trash', 'failed', 'refunded'] },
                ...(globalStartDate ? { dateCreated: { $gte: globalStartDate } } : {}),
                $or: [
                    { 'lineItems.linkedSkuId': skuMatch },
                    { 'lineItems.linkedSkus.skuId': skuMatch },
                ],
            }).lean() as any,

            // Sale Orders
            SaleOrder.find({
                status: { $nin: ['Cancelled', 'Voided'] },
                ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                'lineItems.sku': skuMatch,
            }).lean() as any,

            // Opening Balances (Intentionally excluded from auto-apply because they are a cost source)
            Promise.resolve([]),

            // Purchase Orders (Intentionally excluded from auto-apply because they are a cost source)
            Promise.resolve([]),

            // Manufacturing — output (this SKU is the produced item)
            Manufacturing.find({
                status: { $nin: ['cancelled'] },
                ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                sku: skuMatch,
                $or: [{ totalCost: 0 }, { totalCost: null }, { totalCost: { $exists: false } }],
            }).lean() as any,

            // Manufacturing — consumption (this SKU is used as an ingredient)
            Manufacturing.find({
                status: { $nin: ['cancelled'] },
                ...(globalStartDate ? { createdAt: { $gte: globalStartDate } } : {}),
                'lineItems.sku': skuMatch,
            }).lean() as any,
        ]);

        console.log(`[Apply Cost] SKU=${skuId} | lotCosts: [${[...lotCosts.entries()].map(([k,v]) => `${k}=$${v.toFixed(2)}`).join(', ')}]`);
        console.log(`[Apply Cost] Records: WO=${webOrders.length} SO=${saleOrders.length} OB=${openingBalances.length} PO=${purchaseOrders.length} MFG=${mfgOutputs.length} MFG_CON=${mfgConsumptions.length}`);

        // ══════════════════════════════════════════════
        // 3A: Apply costs to Web Orders
        // ══════════════════════════════════════════════
        let woFixed = 0;
        const woBulk = WebOrder.collection.initializeUnorderedBulkOp();
        let woHasOps = false;

        for (const wo of webOrders) {
            let changed = false;
            const updates: Record<string, any> = {};

            for (let i = 0; i < (wo.lineItems || []).length; i++) {
                const li = wo.lineItems[i];

                // Legacy single-SKU path
                if (matchesSku(li.linkedSkuId) && li.lotNumber && !INVALID_LOT_VALUES.includes(li.lotNumber) && (!li.cost || li.cost === 0)) {
                    const cleanedLot = String(li.lotNumber).trim().replace(/,/g, '').replace(/\.0+$/, '');
                    const baseCost = lotCosts.get(cleanedLot) ?? lotCosts.get(li.lotNumber) ?? 0;
                    if (baseCost > 0) {
                        updates[`lineItems.${i}.cost`] = baseCost * (li.multiplier || 1);
                        changed = true; woFixed++;
                    }
                }

                // Multi-SKU path
                if (li.linkedSkus?.length) {
                    for (let j = 0; j < li.linkedSkus.length; j++) {
                        const ls = li.linkedSkus[j];
                        if (matchesSku(ls.skuId) && ls.lotNumber && !INVALID_LOT_VALUES.includes(ls.lotNumber) && (!ls.cost || ls.cost === 0)) {
                            const cleanedLot = String(ls.lotNumber).trim().replace(/,/g, '').replace(/\.0+$/, '');
                            const baseCost = lotCosts.get(cleanedLot) ?? lotCosts.get(ls.lotNumber) ?? 0;
                            if (baseCost > 0) {
                                const finalCost = baseCost * (ls.multiplier || 1);
                                updates[`lineItems.${i}.linkedSkus.${j}.cost`] = finalCost;
                                if (j === 0) updates[`lineItems.${i}.cost`] = finalCost;
                                changed = true; woFixed++;
                            }
                        }
                    }
                }
            }

            if (changed) {
                updates['updatedAt'] = new Date();
                woBulk.find({ _id: wo._id }).updateOne({ $set: updates });
                woHasOps = true;
                resolvedOrderIds.push(String(wo._id));
            }
        }
        if (woHasOps) await woBulk.execute();

        // ══════════════════════════════════════════════
        // 3B: Apply costs to Sale Orders
        // ══════════════════════════════════════════════
        let soFixed = 0;
        const soBulk = SaleOrder.collection.initializeUnorderedBulkOp();
        let soHasOps = false;

        for (const so of saleOrders) {
            let changed = false;
            const updates: Record<string, any> = {};

            for (let i = 0; i < (so.lineItems || []).length; i++) {
                const li = so.lineItems[i];
                if (matchesSku(li.sku) && li.lotNumber && !INVALID_LOT_VALUES.includes(li.lotNumber) && (!li.cost || li.cost === 0)) {
                    const cleanedLot = String(li.lotNumber).trim().replace(/,/g, '').replace(/\.0+$/, '');
                    const cost = lotCosts.get(cleanedLot) ?? lotCosts.get(li.lotNumber) ?? 0;
                    if (cost > 0) {
                        updates[`lineItems.${i}.cost`] = cost;
                        changed = true; soFixed++;
                    }
                }
            }

            if (changed) {
                updates['updatedAt'] = new Date();
                soBulk.find({ _id: so._id }).updateOne({ $set: updates });
                soHasOps = true;
                resolvedOrderIds.push(String(so._id));
            }
        }
        if (soHasOps) await soBulk.execute();

        // ══════════════════════════════════════════════
        // 3C: Removed Opening Balance cost application
        //     (Opening Balances are a cost source and must be manually entered)
        // ══════════════════════════════════════════════
        let obFixed = 0;

        // ══════════════════════════════════════════════
        // 3D: Removed Purchase Order cost application
        //     (POs are a cost source and must be manually entered)
        // ══════════════════════════════════════════════
        let poFixed = 0;

        // ══════════════════════════════════════════════
        // 3E: Apply costs to Manufacturing outputs
        //     (recalculate totalCost from ingredients/labor)
        // ══════════════════════════════════════════════
        let mfgFixed = 0;
        const mfgBulk = Manufacturing.collection.initializeUnorderedBulkOp();
        let mfgHasOps = false;

        for (const mfg of mfgOutputs) {
            const costPerUnit = calculateJobCostPerUnit(mfg);
            const totalQty = (mfg.qty || 0) + (mfg.qtyDifference || 0);
            const totalCost = costPerUnit * totalQty;

            if (totalCost > 0) {
                mfgBulk.find({ _id: mfg._id }).updateOne({
                    $set: { totalCost, costPerUnit, updatedAt: new Date() }
                });
                mfgHasOps = true; mfgFixed++;
                resolvedOrderIds.push(String(mfg._id));
            }
        }
        if (mfgHasOps) await mfgBulk.execute();

        // ══════════════════════════════════════════════
        // 3F: Apply costs to Manufacturing consumption
        //     (ingredient line items that have cost=0)
        // ══════════════════════════════════════════════
        let mfgConFixed = 0;
        const mfgConBulk = Manufacturing.collection.initializeUnorderedBulkOp();
        let mfgConHasOps = false;

        for (const mfg of mfgConsumptions) {
            let changed = false;
            const updates: Record<string, any> = {};

            for (let i = 0; i < (mfg.lineItems || []).length; i++) {
                const li = mfg.lineItems[i];
                if (!matchesSku(li.sku)) continue;
                if (li.cost && li.cost > 0) continue;
                if (!li.lotNumber || INVALID_LOT_VALUES.includes(li.lotNumber)) continue;

                const cleanedLot = String(li.lotNumber).trim().replace(/,/g, '').replace(/\.0+$/, '');
                const cost = lotCosts.get(cleanedLot) ?? lotCosts.get(li.lotNumber) ?? 0;
                if (cost > 0) {
                    updates[`lineItems.${i}.cost`] = cost;
                    changed = true; mfgConFixed++;
                }
            }

            if (changed) {
                updates['updatedAt'] = new Date();
                mfgConBulk.find({ _id: mfg._id }).updateOne({ $set: updates });
                mfgConHasOps = true;
                resolvedOrderIds.push(String(mfg._id));
            }
        }
        if (mfgConHasOps) await mfgConBulk.execute();

        totalFixed = woFixed + soFixed + obFixed + poFixed + mfgFixed + mfgConFixed;

        console.log(`[Apply Cost] Done | WO=${woFixed} SO=${soFixed} OB=${obFixed} PO=${poFixed} MFG=${mfgFixed} MFG_CON=${mfgConFixed} | Total=${totalFixed}`);

        return NextResponse.json({
            success: true,
            stats: {
                skusProcessed: 1,
                webOrdersFixed: woFixed,
                saleOrdersFixed: soFixed,
                openingBalancesFixed: obFixed,
                purchaseOrdersFixed: poFixed,
                manufacturingFixed: mfgFixed,
                mfgConsumptionFixed: mfgConFixed,
                totalFixed,
            },
            resolvedOrderIds,
        });

    } catch (error: any) {
        console.error('Missing Cost apply error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
