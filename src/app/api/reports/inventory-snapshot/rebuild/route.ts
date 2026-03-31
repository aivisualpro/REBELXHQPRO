import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';
import InventorySnapshot from '@/models/InventorySnapshot';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// In-memory rebuild lock
let isRebuilding = false;
let lastRebuildAt: Date | null = null;
let lastRebuildCount = 0;

export async function GET() {
    return NextResponse.json({ isRebuilding, lastRebuildAt, lastRebuildCount });
}

export async function POST() {
    if (isRebuilding) {
        return NextResponse.json({ error: 'Rebuild already in progress' }, { status: 409 });
    }

    isRebuilding = true;
    const startTime = Date.now();

    try {
        await dbConnect();

        // ─── Step 1: Load SKU metadata (fast - just IDs, names, categories) ───
        const skus = await Sku.find({ isArchived: { $ne: true } })
            .select('_id name category subCategory uom reOrderPoint orderUpto variances')
            .lean();

        // Build variance → SKU ID lookup map
        const varToSku = new Map<string, string>();
        skus.forEach((s: any) => {
            s.variances?.forEach((v: any) => {
                if (v._id) varToSku.set(v._id.toString(), s._id.toString());
            });
        });

        const WO_STATUSES = ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'];

        // ─── Step 2: Run ALL aggregations in parallel inside MongoDB  ───
        // Each returns only ~N_SKU grouped records, NOT millions of raw documents.
        // MongoDB computes these server-side — tiny payload to Node.js.
        const [
            obsAgg,
            posAgg,
            sosAgg,
            mosProdAgg,
            mosConsAgg,
            adjsAgg,
            wosAgg,
            wosVarAgg
        ] = await Promise.all([

            // 1. Opening Balances → group by SKU
            OpeningBalance.aggregate([
                { $group: { _id: { $toString: '$sku' }, qty: { $sum: '$qty' }, costVal: { $sum: { $multiply: ['$qty', { $ifNull: ['$cost', 0] }] } } } }
            ]),

            // 2. Purchase Orders (Received) → group by SKU
            PurchaseOrder.aggregate([
                { $match: { status: 'Received' } },
                { $unwind: '$lineItems' },
                { $group: { _id: { $toString: '$lineItems.sku' }, qty: { $sum: { $ifNull: ['$lineItems.qtyReceived', 0] } }, costVal: { $sum: { $multiply: [{ $ifNull: ['$lineItems.qtyReceived', 0] }, { $ifNull: ['$lineItems.cost', 0] }] } } } }
            ]),

            // 3. Sale Orders (Shipped/Completed) → group qty out by SKU
            SaleOrder.aggregate([
                { $match: { orderStatus: { $in: ['Shipped', 'Completed'] } } },
                { $unwind: '$lineItems' },
                { $group: { _id: { $toString: '$lineItems.sku' }, qty: { $sum: { $ifNull: ['$lineItems.qtyShipped', 0] } } } }
            ]),

            // 4. Manufacturing - Finished Goods IN
            Manufacturing.aggregate([
                { $match: { status: { $ne: 'Pending' } } },
                { $group: { _id: { $toString: '$sku' }, qty: { $sum: { $add: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$qtyDifference', 0] }] } } } }
            ]),

            // 5. Manufacturing - Ingredient Consumption OUT
            Manufacturing.aggregate([
                { $match: { status: 'Fulfilled' } },
                { $unwind: '$lineItems' },
                { $group: { _id: { $toString: { $ifNull: ['$lineItems.sku', null] } }, qty: { $sum: { $multiply: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$lineItems.recipeQty', 0] }] } } } }
            ]),

            // 6. Audit Adjustments → group by SKU
            AuditAdjustment.aggregate([
                { $group: { _id: { $toString: '$sku' }, netQty: { $sum: '$qty' }, costVal: { $sum: { $multiply: ['$qty', { $ifNull: ['$cost', 0] }] } } } }
            ]),

            // 7. Web Orders → deduct by linkedSkuId (multi-linked and single-linked)
            WebOrder.aggregate([
                { $match: { status: { $in: WO_STATUSES } } },
                { $unwind: '$lineItems' },
                {
                    $facet: {
                        multi: [
                            { $match: { 'lineItems.linkedSkus.0': { $exists: true } } },
                            { $unwind: '$lineItems.linkedSkus' },
                            { $group: { _id: '$lineItems.linkedSkus.skuId', qty: { $sum: { $multiply: ['$lineItems.quantity', { $ifNull: ['$lineItems.linkedSkus.multiplier', 1] }] } } } }
                        ],
                        single: [
                            { $match: { 'lineItems.linkedSkus.0': { $exists: false } } },
                            { $group: { _id: { $ifNull: ['$lineItems.linkedSkuId', { $toString: { $ifNull: ['$lineItems.sku', null] } }] }, qty: { $sum: '$lineItems.quantity' } } }
                        ]
                    }
                },
                { $project: { combined: { $concatArrays: ['$multi', '$single'] } } },
                { $unwind: '$combined' },
                { $replaceRoot: { newRoot: '$combined' } },
                { $group: { _id: '$_id', qty: { $sum: '$qty' } } }
            ]),

            // 8. Web Orders by varianceId
            WebOrder.aggregate([
                { $match: { status: { $in: WO_STATUSES } } },
                { $unwind: '$lineItems' },
                { $match: { 'lineItems.varianceId': { $exists: true, $ne: null } } },
                { $group: { _id: { $toString: '$lineItems.varianceId' }, qty: { $sum: '$lineItems.quantity' } } }
            ])
        ]);

        // ─── Step 3: Build O(1) Maps from tiny aggregation results ───
        const obsMap = new Map(obsAgg.map((r: any) => [r._id, r]));
        const posMap = new Map(posAgg.map((r: any) => [r._id, r]));
        const sosMap = new Map(sosAgg.map((r: any) => [r._id, r]));
        const moProdMap = new Map(mosProdAgg.map((r: any) => [r._id, r]));
        const moConsMap = new Map(mosConsAgg.map((r: any) => [r._id, r]));
        const adjsMap = new Map(adjsAgg.map((r: any) => [r._id, r]));
        const wosMap = new Map(wosAgg.map((r: any) => [r._id, r]));
        const wosVarMap = new Map(wosVarAgg.map((r: any) => [r._id, r]));

        // ─── Step 4: Compute per-SKU inventory position (pure JS, O(N_skus)) ───
        const now = new Date();
        const snapshots = skus.map((sku: any) => {
            const id = sku._id.toString();

            let qtyIn = 0;
            let qtyOut = 0;
            let totalCostIn = 0;

            const ob = obsMap.get(id);
            if (ob) { qtyIn += ob.qty || 0; totalCostIn += ob.costVal || 0; }

            const po = posMap.get(id);
            if (po) { qtyIn += po.qty || 0; totalCostIn += po.costVal || 0; }

            const moProd = moProdMap.get(id);
            if (moProd) { qtyIn += moProd.qty || 0; }

            const moCons = moConsMap.get(id);
            if (moCons) { qtyOut += moCons.qty || 0; }

            const adj = adjsMap.get(id);
            if (adj) {
                const net = adj.netQty || 0;
                if (net > 0) { qtyIn += net; totalCostIn += adj.costVal || 0; }
                else qtyOut += Math.abs(net);
            }

            const so = sosMap.get(id);
            if (so) qtyOut += so.qty || 0;

            const wo = wosMap.get(id);
            if (wo) qtyOut += wo.qty || 0;

            (sku.variances || []).forEach((v: any) => {
                const vid = v._id?.toString();
                if (!vid) return;
                const woVar = wosVarMap.get(vid);
                if (woVar) qtyOut += woVar.qty || 0;
            });

            const availableQty = qtyIn - qtyOut;
            const avgCost = qtyIn > 0 ? totalCostIn / qtyIn : 0;
            const totalCost = Math.max(0, availableQty) * avgCost;

            return {
                _id: id,
                name: sku.name || '',
                category: sku.category || 'Uncategorized',
                subCategory: sku.subCategory || 'Uncategorized',
                uom: sku.uom || '',
                reOrderPoint: sku.reOrderPoint || 0,
                orderUpto: sku.orderUpto || 0,
                availableQty,
                avgCost,
                totalCost,
                computedAt: now,
            };
        });

        // ─── Step 5: Bulk upsert to snapshot collection ───
        if (snapshots.length > 0) {
            const bulkOps = snapshots.map((s: any) => ({
                replaceOne: {
                    filter: { _id: s._id },
                    replacement: s,
                    upsert: true
                }
            }));
            await InventorySnapshot.bulkWrite(bulkOps, { ordered: false });
        }

        lastRebuildAt = now;
        lastRebuildCount = snapshots.length;
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        return NextResponse.json({
            success: true,
            computedAt: now,
            skuCount: snapshots.length,
            durationSeconds: parseFloat(duration)
        });

    } catch (err: any) {
        console.error('Inventory snapshot rebuild error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        isRebuilding = false;
    }
}
