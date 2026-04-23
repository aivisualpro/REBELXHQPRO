import { NextRequest, NextResponse, after } from 'next/server';
import dbConnect from '@/lib/mongoose';
import mongoose from 'mongoose';
import Manufacturing from '@/models/Manufacturing';
import WebOrder from '@/models/WebOrder';
import SaleOrder from '@/models/SaleOrder';

import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import AuditAdjustment from '@/models/AuditAdjustment';
import User from '@/models/User';
import { Recipe } from '@/models/Recipe';
import { getSkuTiers } from '@/lib/sku-tiers';
import { syncManufacturingToAppSheet, deleteManufacturingFromAppSheet, syncManufacturingLineItemsToAppSheet, deleteManufacturingLineItemsFromAppSheet } from '@/lib/appsheet';

export const dynamic = 'force-dynamic';

// Helper to parse duration "HH:MM:SS" to decimal hours
const parseDuration = (duration: string): number => {
    if (!duration) return 0;
    const parts = duration.split(':').map(p => parseFloat(p) || 0);
    if (parts.length === 3) {
        return parts[0] + parts[1] / 60 + parts[2] / 3600;
    } else if (parts.length === 2) {
        return parts[0] + parts[1] / 60;
    }
    return 0;
};

// Helper to get ingredient cost from OB or PO
async function getIngredientCostFromSource(ingredientSkuId: string, ingredientLotNumber: string): Promise<number> {
    if (!ingredientSkuId || !ingredientLotNumber) return 0;

    // Check Opening Balance
    const ob = await OpeningBalance.findOne({
        sku: ingredientSkuId,
        lotNumber: ingredientLotNumber
    }).select('cost').lean();
    if (ob) return ob.cost || 0;

    // Check Purchase Orders
    const po = await PurchaseOrder.findOne({
        'lineItems': {
            $elemMatch: {
                sku: ingredientSkuId,
                lotNumber: ingredientLotNumber
            }
        }
    }).select('lineItems').lean();

    if (po && po.lineItems) {
        const line = po.lineItems.find((l: any) => {
            const lSku = l.sku?._id || l.sku;
            return lSku?.toString() === ingredientSkuId && l.lotNumber === ingredientLotNumber;
        });
        if (line) return line.cost || line.price || 0;
    }

    return 0;
}

// Calculate manufacturing job cost on the fly (same logic as Lots API)
async function calculateManufacturingJobCost(job: any): Promise<number> {
    const qtyManufactured = (job.qty || 0) + (job.qtyDifference || 0);
    if (qtyManufactured <= 0) return 0;

    // If totalCost is already calculated and saved, use it
    if (job.totalCost && job.totalCost > 0) {
        return job.totalCost / qtyManufactured;
    }

    // Otherwise, calculate on the fly from labor and ingredients
    let laborCost = 0;
    let ingredientCost = 0;

    // Sum labor costs
    if (job.labor && Array.isArray(job.labor)) {
        job.labor.forEach((labor: any) => {
            const hours = parseDuration(labor.duration);
            laborCost += hours * (labor.hourlyRate || 0);
        });
    }

    // Sum ingredient costs - lookup costs from OpeningBalance/PurchaseOrder
    if (job.lineItems && Array.isArray(job.lineItems)) {
        for (const lineItem of job.lineItems) {
            const itemSkuId = (typeof lineItem.sku === 'object' && lineItem.sku !== null)
                ? lineItem.sku._id?.toString()
                : lineItem.sku?.toString();
            const bomQty = (lineItem.recipeQty || 0) * (job.qty || 0);
            const qtyExtra = lineItem.qtyExtra || 0;
            const qtyScrapped = lineItem.qtyScrapped || 0;
            const totalConsumed = bomQty + qtyExtra + qtyScrapped;

            // Lookup ingredient cost
            const unitCost = await getIngredientCostFromSource(itemSkuId, lineItem.lotNumber);
            ingredientCost += totalConsumed * unitCost;
        }
    }

    const totalJobCost = laborCost + ingredientCost;
    return totalJobCost / qtyManufactured;
}

// Optimized: Batch fetch all costs at once instead of sequential queries
async function enrichLineItemsWithCost(lineItems: any[]) {
    if (!lineItems || lineItems.length === 0) return lineItems;

    // Collect all unique sku+lot combinations
    const lookupKeys = new Set<string>();
    const lookupData: { skuId: string; lotNumber: string }[] = [];

    lineItems.forEach(item => {
        const skuId = item.sku?._id?.toString() || item.sku?.toString();
        const lotNumber = item.lotNumber;
        if (skuId && lotNumber) {
            const key = `${skuId}:${lotNumber}`;
            if (!lookupKeys.has(key)) {
                lookupKeys.add(key);
                lookupData.push({ skuId, lotNumber });
            }
        }
    });

    if (lookupData.length === 0) {
        return lineItems.map(item => ({ ...item, cost: 0 }));
    }

    // Extract unique values for queries
    const allSkuIds = [...new Set(lookupData.map(d => d.skuId))];
    const allLotNumbers = [...new Set(lookupData.map(d => d.lotNumber))];

    // Batch fetch all potential cost sources in parallel
    const [openingBalances, purchaseOrders, manufacturingJobs, auditAdjustments] = await Promise.all([
        OpeningBalance.find({
            sku: { $in: allSkuIds },
            lotNumber: { $in: allLotNumbers }
        }).select('sku lotNumber cost').lean(),

        PurchaseOrder.find({
            'lineItems.sku': { $in: allSkuIds },
            'lineItems.lotNumber': { $in: allLotNumbers }
        }).select('lineItems.sku lineItems.lotNumber lineItems.cost lineItems.price').lean(),

        Manufacturing.find({
            $or: [
                { sku: { $in: allSkuIds }, lotNumber: { $in: allLotNumbers } },
                { sku: { $in: allSkuIds }, label: { $in: allLotNumbers } }
            ]
        }).select('sku lotNumber label totalCost qty qtyDifference').lean(),

        AuditAdjustment.find({
            sku: { $in: allSkuIds },
            lotNumber: { $in: allLotNumbers }
        }).select('sku lotNumber cost').lean()
    ]);

    // Build cost lookup map: key = "skuId:lotNumber" -> cost
    const costMap = new Map<string, number>();

    // 1. Opening Balances (highest priority)
    openingBalances.forEach((ob: any) => {
        const key = `${ob.sku?.toString()}:${ob.lotNumber}`;
        if (ob.cost && !costMap.has(key)) {
            costMap.set(key, ob.cost);
        }
    });

    // 2. Purchase Orders
    purchaseOrders.forEach((po: any) => {
        po.lineItems?.forEach((line: any) => {
            const skuId = line.sku?._id?.toString() || line.sku?.toString();
            const key = `${skuId}:${line.lotNumber}`;
            if (!costMap.has(key) && (line.cost || line.price)) {
                costMap.set(key, line.cost || line.price);
            }
        });
    });

    // 3. Manufacturing Jobs (calculate per-unit cost)
    manufacturingJobs.forEach((job: any) => {
        const skuId = job.sku?._id?.toString() || job.sku?.toString();
        const lot = job.lotNumber || job.label;
        const key = `${skuId}:${lot}`;
        if (!costMap.has(key) && job.totalCost) {
            const qtyProduced = (job.qty || 0) + (job.qtyDifference || 0);
            if (qtyProduced > 0) {
                costMap.set(key, job.totalCost / qtyProduced);
            }
        }
    });

    // 4. Audit Adjustments
    auditAdjustments.forEach((adj: any) => {
        const key = `${adj.sku?.toString()}:${adj.lotNumber}`;
        if (!costMap.has(key) && adj.cost) {
            costMap.set(key, adj.cost);
        }
    });

    // Map costs to line items
    return lineItems.map(item => {
        const skuId = item.sku?._id?.toString() || item.sku?.toString();
        const key = `${skuId}:${item.lotNumber}`;
        const cost = costMap.get(key) || 0;
        return { ...item, cost };
    });
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        void Sku;
        void User;
        void Recipe;
        void AuditAdjustment;

        const { id } = await context.params;

        const order = await Manufacturing.findById(id)
            .populate('createdBy', 'firstName lastName email')
            .populate('finishedBy', 'firstName lastName email')
            .populate('labor.user', 'firstName lastName email')
            .populate('notes.createdBy', 'firstName lastName email')
            .populate('qualityCheck.checkedBy', 'firstName lastName email')
            .populate('qualityCheck.packagedBy', 'firstName lastName email')
            .populate('qualityCheck.qualityCheckedBy', 'firstName lastName email')
            .populate('recipesId', 'name sku steps qty notes')
            .lean();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Manual SKU hydration using native driver (handles String _id, ObjectId _id, and legacyId)
        const rawSkuIds = new Set<string>();
        if (order.sku) rawSkuIds.add(String(order.sku));
        order.lineItems?.forEach((li: any) => { if (li.sku) rawSkuIds.add(String(li.sku)); });

        const db = mongoose.connection.db;
        let skuById = new Map<string, any>();
        let skuByLegacy = new Map<string, any>();

        if (db && rawSkuIds.size > 0) {
            const rawSkuArr = Array.from(rawSkuIds);
            const objectIds = rawSkuArr
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));

            const allSkus = await db.collection('skus').find({
                $or: [
                    { _id: { $in: rawSkuArr } },
                    { _id: { $in: objectIds } },
                    { legacyId: { $in: rawSkuArr } }
                ]
            } as any, { projection: { _id: 1, name: 1, image: 1, category: 1, legacyId: 1 } }).toArray();

            allSkus.forEach((s: any) => {
                skuById.set(String(s._id), s);
                if (s.legacyId) skuByLegacy.set(String(s.legacyId), s);
            });
        }

        // Hydrate order.sku
        if (order.sku) {
            const skuStr = String(order.sku);
            const found = skuById.get(skuStr) || skuByLegacy.get(skuStr);
            if (found) {
                (order as any).sku = { _id: String(found._id), name: found.name, image: found.image, category: found.category };
            }
        }

        // Hydrate lineItems.sku
        order.lineItems?.forEach((li: any) => {
            if (!li.sku) return;
            const skuStr = String(li.sku);
            const found = skuById.get(skuStr) || skuByLegacy.get(skuStr);
            if (found) {
                li.sku = { _id: String(found._id), name: found.name, category: found.category };
            }
        });

        // Enrich Line Items with Costs SYNCHRONOUSLY so the frontend renders correctly instantly
        let enrichedItems = order.lineItems;
        let materialCost = 0, packagingCost = 0, laborCost = 0, totalCost = 0;

        if (enrichedItems && Array.isArray(enrichedItems)) {
            enrichedItems = await enrichLineItemsWithCost(enrichedItems) as any;
            order.lineItems = enrichedItems;

            for (const li of enrichedItems as any[]) {
                const bomQty = (li.recipeQty || 0) * (order.qty || 0);
                const sa = li.sa ? li.sa / 100 : 0;
                const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                const totalQty = bomQty + qtyExtra + (li.qtyScrapped || 0);
                const unitCost = li.cost || 0;
                const lineCost = totalQty * unitCost;
                const category = li.sku?.category || '';
                
                if (typeof category === 'string' && category.toLowerCase().includes('packaging')) {
                    packagingCost += lineCost;
                } else {
                    materialCost += lineCost;
                }
            }
        }

        if (order.labor && Array.isArray(order.labor)) {
            for (const l of order.labor) {
                const dur = l.duration || '';
                const parts = dur.split(':').map((v: string) => parseFloat(v) || 0);
                const hours = parts.length === 3 ? parts[0] + parts[1] / 60 + parts[2] / 3600 : parts.length === 2 ? parts[0] + parts[1] / 60 : 0;
                laborCost += hours * (l.hourlyRate || 0);
            }
        }

        totalCost = materialCost + packagingCost + laborCost;
        order.materialCost = materialCost;
        order.packagingCost = packagingCost;
        order.laborCost = laborCost;
        order.totalCost = totalCost;

        // Enrich with Tiers (fast: single lookup from cache)
        const allSkuIds = new Set<string>();
        if (order.sku && typeof order.sku === 'object' && order.sku !== null) {
            allSkuIds.add(((order.sku as any)._id || '').toString());
        }
        order.lineItems?.forEach((li: any) => {
            const id = li.sku?._id || li.sku;
            if (id) allSkuIds.add(id.toString());
        });

        const tiers = await getSkuTiers(Array.from(allSkuIds));
        if (order.sku && typeof order.sku === 'object' && order.sku !== null) {
            (order.sku as any).tier = tiers[((order.sku as any)._id || '').toString()];
        }
        order.lineItems?.forEach((li: any) => {
            const id = li.sku?._id || li.sku;
            if (id && li.sku && typeof li.sku === 'object') {
                li.sku.tier = tiers[id.toString()];
            }
        });

        // ─── Background: Persist costs ──────────────────────────────
        // Syncs the newly computed costs to the DB asynchronously so page response isn't blocked by writes
        after(async () => {
            try {
                await dbConnect();
                await Manufacturing.updateOne(
                    { _id: id },
                    { $set: { materialCost, packagingCost, laborCost, totalCost, lineItems: enrichedItems } }
                );
            } catch (e) {
                console.error('Background cost persist failed:', e);
            }
        });

        return NextResponse.json(order);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * After a manufacturing order cost-per-unit changes, push the new cost to every
 * WebOrder and SaleOrder line item that references this SKU + lot combination.
 * Only fires when costPerUnit actually changes (delta > $0.001).
 */
async function propagateLotCostToOrders(
    skuId: string,
    lotNumber: string,
    newCostPerUnit: number
): Promise<void> {
    if (!skuId || !lotNumber || !(newCostPerUnit > 0)) return;

    // Build match filter: target any line item using this skuId + lotNumber
    // Handles both legacy linkedSkuId and modern linkedSkus array
    const lineItemFilter = {
        $or: [
            // Legacy: single SKU field
            { 'lineItems.linkedSkuId': skuId, 'lineItems.lotNumber': lotNumber },
            // Modern: linkedSkus sub-array
            { 'lineItems.linkedSkus.skuId': skuId, 'lineItems.linkedSkus.lotNumber': lotNumber },
        ]
    };

    // Process WebOrders
    const webOrders = await WebOrder.find(lineItemFilter).select('lineItems').lean();
    if (webOrders.length > 0) {
        const woBulk = WebOrder.collection.initializeUnorderedBulkOp();
        let woOps = 0;

        for (const order of webOrders as any[]) {
            for (let i = 0; i < order.lineItems.length; i++) {
                const li = order.lineItems[i];

                // Legacy path: single linkedSkuId
                if (li.linkedSkuId === skuId && li.lotNumber === lotNumber) {
                    const multiplier = 1; // legacy path has no multiplier concept here
                    woBulk.find({ _id: order._id }).updateOne({
                        $set: { [`lineItems.${i}.cost`]: newCostPerUnit * multiplier }
                    });
                    woOps++;
                }

                // Modern path: linkedSkus array
                if (li.linkedSkus && Array.isArray(li.linkedSkus)) {
                    for (let j = 0; j < li.linkedSkus.length; j++) {
                        const ls = li.linkedSkus[j];
                        if (ls.skuId === skuId && ls.lotNumber === lotNumber) {
                            const newLinkedCost = newCostPerUnit * (ls.multiplier || 1);
                            woBulk.find({ _id: order._id }).updateOne({
                                $set: {
                                    [`lineItems.${i}.linkedSkus.${j}.cost`]: newLinkedCost,
                                    // Keep legacy cost in sync with first linked SKU
                                    ...(j === 0 ? { [`lineItems.${i}.cost`]: newLinkedCost } : {})
                                }
                            });
                            woOps++;
                        }
                    }
                }
            }
        }
        if (woOps > 0) {
            await woBulk.execute();
            console.log(`✅ [cost-propagation] Updated ${woOps} WebOrder line items for SKU=${skuId} Lot=${lotNumber} cost=$${newCostPerUnit.toFixed(4)}`);
        }
    }

    // Process SaleOrders
    const saleOrders = await SaleOrder.find(lineItemFilter).select('lineItems').lean();
    if (saleOrders.length > 0) {
        const soBulk = SaleOrder.collection.initializeUnorderedBulkOp();
        let soOps = 0;

        for (const order of saleOrders as any[]) {
            for (let i = 0; i < order.lineItems.length; i++) {
                const li = order.lineItems[i];

                if (li.linkedSkuId === skuId && li.lotNumber === lotNumber) {
                    soBulk.find({ _id: order._id }).updateOne({
                        $set: { [`lineItems.${i}.cost`]: newCostPerUnit }
                    });
                    soOps++;
                }

                if (li.linkedSkus && Array.isArray(li.linkedSkus)) {
                    for (let j = 0; j < li.linkedSkus.length; j++) {
                        const ls = li.linkedSkus[j];
                        if (ls.skuId === skuId && ls.lotNumber === lotNumber) {
                            const newLinkedCost = newCostPerUnit * (ls.multiplier || 1);
                            soBulk.find({ _id: order._id }).updateOne({
                                $set: {
                                    [`lineItems.${i}.linkedSkus.${j}.cost`]: newLinkedCost,
                                    ...(j === 0 ? { [`lineItems.${i}.cost`]: newLinkedCost } : {})
                                }
                            });
                            soOps++;
                        }
                    }
                }
            }
        }
        if (soOps > 0) {
            await soBulk.execute();
            console.log(`✅ [cost-propagation] Updated ${soOps} SaleOrder line items for SKU=${skuId} Lot=${lotNumber} cost=$${newCostPerUnit.toFixed(4)}`);
        }
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

        // Fetch the old order BEFORE update to detect line item changes AND capture old cost-per-unit
        const oldOrder: any = await Manufacturing.findById(id).select('lineItems._id totalCost qty qtyDifference sku lotNumber label').lean();
        const oldLineItemIds = new Set((oldOrder?.lineItems || []).map((li: any) => li._id?.toString()));
        const oldQtyProduced = (oldOrder?.qty || 0) + (oldOrder?.qtyDifference || 0);
        const oldCostPerUnit = (oldQtyProduced > 0 && oldOrder?.totalCost > 0)
            ? oldOrder.totalCost / oldQtyProduced
            : 0;

        const order = await Manufacturing.findByIdAndUpdate(id, body, { new: true })
            .populate('createdBy', 'firstName lastName email')
            .populate('finishedBy', 'firstName lastName email')
            .populate('labor.user', 'firstName lastName email')
            .populate('notes.createdBy', 'firstName lastName email')
            .populate('qualityCheck.checkedBy', 'firstName lastName email')
            .populate('qualityCheck.packagedBy', 'firstName lastName email')
            .populate('qualityCheck.qualityCheckedBy', 'firstName lastName email')
            .populate('recipesId', 'name sku steps qty notes')
            .lean();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Manual SKU hydration using native driver (handles String _id, ObjectId _id, and legacyId)
        const rawSkuIds = new Set<string>();
        if (order.sku) rawSkuIds.add(String(order.sku));
        order.lineItems?.forEach((li: any) => { if (li.sku) rawSkuIds.add(String(li.sku)); });

        const db = mongoose.connection.db;
        let skuById = new Map<string, any>();
        let skuByLegacy = new Map<string, any>();

        if (db && rawSkuIds.size > 0) {
            const rawSkuArr = Array.from(rawSkuIds);
            const objectIds = rawSkuArr
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));

            const allSkus = await db.collection('skus').find({
                $or: [
                    { _id: { $in: rawSkuArr } },
                    { _id: { $in: objectIds } },
                    { legacyId: { $in: rawSkuArr } }
                ]
            } as any, { projection: { _id: 1, name: 1, image: 1, category: 1, legacyId: 1 } }).toArray();

            allSkus.forEach((s: any) => {
                skuById.set(String(s._id), s);
                if (s.legacyId) skuByLegacy.set(String(s.legacyId), s);
            });
        }

        if (order.sku) {
            const skuStr = String(order.sku);
            const found = skuById.get(skuStr) || skuByLegacy.get(skuStr);
            if (found) {
                (order as any).sku = { _id: String(found._id), name: found.name, image: found.image, category: found.category };
            }
        }
        order.lineItems?.forEach((li: any) => {
            if (!li.sku) return;
            const skuStr = String(li.sku);
            const found = skuById.get(skuStr) || skuByLegacy.get(skuStr);
            if (found) {
                li.sku = { _id: String(found._id), name: found.name, category: found.category };
            }
        });

        // Enrich with Tiers (fast: single lookup)
        const allSkuIds = new Set<string>();
        if (order.sku && typeof order.sku === 'object' && order.sku !== null) {
            allSkuIds.add(((order.sku as any)._id || '').toString());
        }
        order.lineItems?.forEach((li: any) => {
            const id = li.sku?._id || li.sku;
            if (id) allSkuIds.add(id.toString());
        });

        const tiers = await getSkuTiers(Array.from(allSkuIds));
        if (order.sku && typeof order.sku === 'object' && order.sku !== null) {
            (order.sku as any).tier = tiers[((order.sku as any)._id || '').toString()];
        }
        order.lineItems?.forEach((li: any) => {
            const id = li.sku?._id || li.sku;
            if (id && li.sku && typeof li.sku === 'object') {
                li.sku.tier = tiers[id.toString()];
            }
        });

        // ─── Background: Enrich costs + AppSheet sync ────────────────────────
        const orderIdStr = (order as any)._id?.toString();
        const hasLineItemsInBody = body.lineItems !== undefined;

        after(async () => {
            try {
                await dbConnect();

                // Enrich line items with fresh costs + persist
                const freshOrder: any = await Manufacturing.findById(orderIdStr).lean();
                if (freshOrder && freshOrder.lineItems && Array.isArray(freshOrder.lineItems)) {
                    const enrichedItems = await enrichLineItemsWithCost(freshOrder.lineItems);

                    let materialCost = 0, packagingCost = 0, laborCost = 0;
                    for (const li of enrichedItems as any[]) {
                        const bomQty = (li.recipeQty || 0) * (freshOrder.qty || 0);
                        const sa = li.sa ? li.sa / 100 : 0;
                        const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                        const totalQty = bomQty + qtyExtra + (li.qtyScrapped || 0);
                        const unitCost = li.cost || 0;
                        const lineCost = totalQty * unitCost;
                        const category = li.sku?.category || '';
                        if (typeof category === 'string' && category.toLowerCase().includes('packaging')) {
                            packagingCost += lineCost;
                        } else {
                            materialCost += lineCost;
                        }
                    }

                    if (freshOrder.labor && Array.isArray(freshOrder.labor)) {
                        for (const l of freshOrder.labor) {
                            const dur = l.duration || '';
                            const parts = dur.split(':').map((v: string) => parseFloat(v) || 0);
                            const hours = parts.length === 3 ? parts[0] + parts[1] / 60 + parts[2] / 3600 : parts.length === 2 ? parts[0] + parts[1] / 60 : 0;
                            laborCost += hours * (l.hourlyRate || 0);
                        }
                    }

                    const totalCost = materialCost + packagingCost + laborCost;

                    await Manufacturing.updateOne(
                        { _id: orderIdStr },
                        { $set: { materialCost, packagingCost, laborCost, totalCost, lineItems: enrichedItems } }
                    );

                    // ── Auto-propagate cost to all affected orders if cost-per-unit changed ──
                    const newQtyProduced = (freshOrder.qty || 0) + (freshOrder.qtyDifference || 0);
                    const newCostPerUnit = newQtyProduced > 0 ? totalCost / newQtyProduced : 0;
                    const costChanged = Math.abs(newCostPerUnit - oldCostPerUnit) > 0.001;

                    if (costChanged && newCostPerUnit > 0) {
                        const skuId = freshOrder.sku?._id?.toString() || freshOrder.sku?.toString();
                        const lotNumber = freshOrder.lotNumber || freshOrder.label;
                        if (skuId && lotNumber) {
                            console.log(`💰 [cost-propagation] Cost changed for SKU=${skuId} Lot=${lotNumber}: $${oldCostPerUnit.toFixed(4)} → $${newCostPerUnit.toFixed(4)}. Propagating...`);
                            await propagateLotCostToOrders(skuId, lotNumber, newCostPerUnit);
                        }
                    }
                }

                // AppSheet sync
                if (orderIdStr) {
                    await syncManufacturingOrderToAppSheet(orderIdStr, 'Edit');

                    if (hasLineItemsInBody) {
                        const syncOrder: any = await Manufacturing.findById(orderIdStr).lean();
                        if (syncOrder) {
                            const newLineItems = syncOrder.lineItems || [];
                            const newLineItemIds = new Set(newLineItems.map((li: any) => li._id?.toString()));

                            const deletedIds = [...oldLineItemIds].filter(id => !newLineItemIds.has(id)) as string[];
                            if (deletedIds.length > 0) {
                                await deleteManufacturingLineItemsFromAppSheet(deletedIds);
                            }

                            const addedItems = newLineItems.filter((li: any) => !oldLineItemIds.has(li._id?.toString()));
                            if (addedItems.length > 0) {
                                await syncManufacturingLineItemsToAppSheet(syncOrder, addedItems, 'Add');
                            }

                            const updatedItems = newLineItems.filter((li: any) => oldLineItemIds.has(li._id?.toString()));
                            if (updatedItems.length > 0) {
                                await syncManufacturingLineItemsToAppSheet(syncOrder, updatedItems, 'Edit');
                            }
                        }
                    }
                }
            } catch (bgError) {
                console.error('❌ Background PATCH processing failed:', bgError);
            }
        });

        return NextResponse.json(order);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Shared helper: populate and sync manufacturing order to AppSheet
async function syncManufacturingOrderToAppSheet(orderId: string, action: 'Add' | 'Edit') {
    try {
        await dbConnect();
        const populatedOrder = await Manufacturing.findById(orderId)
            .populate('createdBy', 'firstName lastName email')
            .populate('finishedBy', 'firstName lastName email')
            .lean();

        if (populatedOrder) {
            // Hydrate SKU with legacyId for AppSheet mapping
            if (populatedOrder.sku) {
                const skuDoc = await Sku.findById(populatedOrder.sku).select('name legacyId').lean();
                if (skuDoc) {
                    (populatedOrder as any).sku = skuDoc;
                }
            }
            await syncManufacturingToAppSheet(populatedOrder, action);
            console.log(`✅ Manufacturing order ${action} synced to AppSheet:`, orderId);
        }
    } catch (syncError) {
        console.error('❌ Background AppSheet Manufacturing sync failed:', syncError);
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;

        // Fetch the order BEFORE deleting so we have createdAt for AppSheet key matching
        const orderToDelete = await Manufacturing.findById(id)
            .populate('createdBy', 'firstName lastName email')
            .populate('finishedBy', 'firstName lastName email')
            .lean();

        if (!orderToDelete) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        await Manufacturing.findByIdAndDelete(id);

        // Background sync: delete from AppSheet matching by TimeStamp
        after(async () => {
            try {
                // Delete parent order from AppSheet
                await deleteManufacturingFromAppSheet(orderToDelete);

                // Delete all line items from AppSheet
                const lineItemIds = (orderToDelete.lineItems || []).map((li: any) => li._id?.toString()).filter(Boolean);
                if (lineItemIds.length > 0) {
                    await deleteManufacturingLineItemsFromAppSheet(lineItemIds);
                }

                console.log('✅ Manufacturing order + line items deleted from AppSheet:', id);
            } catch (syncError) {
                console.error('❌ Background AppSheet Manufacturing delete failed:', syncError);
            }
        });

        return NextResponse.json({ message: 'Order deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
