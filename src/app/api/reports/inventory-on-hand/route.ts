import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import InventorySnapshot from '@/models/InventorySnapshot';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ─── Shared: MongoDB $group aggregation for a given date ceiling ─────────────
// Runs entirely in MongoDB — returns only ~N_SKU summary records, not raw docs.
async function computeInventoryAtDate(tillEnd: Date) {
    const dateQ = { createdAt: { $lte: tillEnd } };
    const woDateQ = { dateCreated: { $lte: tillEnd } };
    const WO_STATUSES = ['completed', 'Completed'];

    const [obsAgg, posAgg, sosAgg, mosProdRaw, mosConsAgg, adjsAgg, wosAgg, wosVarAgg, skusRaw] = await Promise.all([
        OpeningBalance.aggregate([
            { $match: dateQ },
            { $group: { _id: { $toString: '$sku' }, qty: { $sum: '$qty' }, costVal: { $sum: { $multiply: ['$qty', { $ifNull: ['$cost', 0] }] } } } }
        ]),
        PurchaseOrder.aggregate([
            { $match: { status: 'Received', ...dateQ } },
            { $unwind: '$lineItems' },
            { $group: { _id: { $toString: '$lineItems.sku' }, qty: { $sum: { $ifNull: ['$lineItems.qtyReceived', 0] } }, costVal: { $sum: { $multiply: [{ $ifNull: ['$lineItems.qtyReceived', 0] }, { $ifNull: ['$lineItems.cost', 0] }] } } } }
        ]),
        SaleOrder.aggregate([
            { $match: { orderStatus: { $in: ['Shipped', 'Completed'] }, ...dateQ } },
            { $unwind: '$lineItems' },
            { $group: { _id: { $toString: '$lineItems.sku' }, qty: { $sum: { $ifNull: ['$lineItems.qtyShipped', 0] } } } }
        ]),
        // Manufacturing production — find().lean() for BOM cost math + labor parsing
        Manufacturing.find({ status: { $nin: ['Pending', 'Trash'] }, ...dateQ })
            .select('sku qty qtyDifference lineItems labor status')
            .lean(),
        Manufacturing.aggregate([
            { $match: { status: 'Fulfilled', ...dateQ } },
            { $unwind: '$lineItems' },
            { $group: { _id: { $toString: { $ifNull: ['$lineItems.sku', null] } }, qty: { $sum: { $multiply: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$lineItems.recipeQty', 0] }] } } } }
        ]),
        AuditAdjustment.aggregate([
            { $match: dateQ },
            { $group: { _id: { $toString: '$sku' }, netQty: { $sum: '$qty' }, costVal: { $sum: { $multiply: ['$qty', { $ifNull: ['$cost', 0] }] } } } }
        ]),
        WebOrder.aggregate([
            { $match: { status: { $in: WO_STATUSES }, ...woDateQ } },
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
        WebOrder.aggregate([
            { $match: { status: { $in: WO_STATUSES }, ...woDateQ } },
            { $unwind: '$lineItems' },
            { $match: { 'lineItems.varianceId': { $exists: true, $ne: null } } },
            { $group: { _id: { $toString: '$lineItems.varianceId' }, qty: { $sum: '$lineItems.quantity' } } }
        ]),
        Sku.find({ isArchived: { $ne: true } }).select('_id name category subCategory uom reOrderPoint orderUpto variances').lean()
    ]);

    const obsMap = new Map(obsAgg.map((r: any) => [r._id, r]));
    const posMap = new Map(posAgg.map((r: any) => [r._id, r]));
    const sosMap = new Map(sosAgg.map((r: any) => [r._id, r]));
    const moConsMap = new Map(mosConsAgg.map((r: any) => [r._id, r]));
    const adjsMap = new Map(adjsAgg.map((r: any) => [r._id, r]));
    const wosMap = new Map(wosAgg.map((r: any) => [r._id, r]));
    const wosVarMap = new Map(wosVarAgg.map((r: any) => [r._id, r]));

    // Compute Manufacturing production cost in Node.js (BOM math + labor)
    const moProdMap = new Map<string, { qty: number; costVal: number }>();
    (mosProdRaw as any[]).forEach((mo: any) => {
        const id = mo.sku?.toString();
        if (!id) return;
        const qtyProduced = (mo.qty || 0) + (mo.qtyDifference || 0);
        let moCost = 0;
        mo.lineItems?.forEach((li: any) => {
            const bomQty = (mo.qty || 0) * (li.recipeQty || 0);
            const sa = (li.sa || 0) / 100;
            const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
            moCost += (bomQty + (li.qtyScrapped || 0) + qtyExtra) * (li.cost || 0);
        });
        mo.labor?.forEach((lab: any) => {
            const parts = (lab.duration || '0:0:0').split(':');
            const hours = parseInt(parts[0] || '0') + parseInt(parts[1] || '0') / 60 + parseInt(parts[2] || '0') / 3600;
            moCost += hours * (lab.hourlyRate || 0);
        });
        const ex = moProdMap.get(id) || { qty: 0, costVal: 0 };
        ex.qty += qtyProduced;
        if (qtyProduced > 0) ex.costVal += moCost;
        moProdMap.set(id, ex);
    });

    return skusRaw.map((sku: any) => {
        const id = sku._id.toString();
        let qtyIn = 0, qtyOut = 0, totalCostIn = 0;

        const ob = obsMap.get(id);
        if (ob) { qtyIn += ob.qty || 0; totalCostIn += ob.costVal || 0; }

        const po = posMap.get(id);
        if (po) { qtyIn += po.qty || 0; totalCostIn += po.costVal || 0; }

        const moProd = moProdMap.get(id);
        if (moProd) { qtyIn += moProd.qty || 0; totalCostIn += moProd.costVal || 0; } // ← cost included

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
        };
    });
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const tillDate = searchParams.get('tillDate');
        const showAll = searchParams.get('showAll') === 'true';
        const reorderOnly = searchParams.get('reorderOnly') === 'true';

        // ── Today's date in YYYY-MM-DD ──────────────────────────────────────
        const today = new Date().toISOString().split('T')[0];
        const isHistorical = tillDate && tillDate !== today;

        let records: any[];

        if (isHistorical) {
            // Historical query: compute on-the-fly with $group aggregations (date-filtered)
            const tillEnd = new Date(tillDate + 'T23:59:59.999Z');
            const all = await computeInventoryAtDate(tillEnd);

            // Apply filters in JS after computation
            records = all.filter((r: any) => {
                if (!showAll && !reorderOnly && r.availableQty <= 0) return false;
                if (reorderOnly && r.availableQty >= r.reOrderPoint) return false;
                return true;
            }).sort((a: any, b: any) =>
                a.category.localeCompare(b.category) || a.subCategory.localeCompare(b.subCategory) || a.name.localeCompare(b.name)
            );
        } else {
            // Current snapshot — instant reads from pre-computed collection
            const query: any = {};
            if (!showAll && !reorderOnly) query.availableQty = { $gt: 0 };
            if (reorderOnly) query.$expr = { $lt: ['$availableQty', '$reOrderPoint'] };
            records = await InventorySnapshot.find(query).sort({ category: 1, subCategory: 1, name: 1 }).lean();
        }

        return NextResponse.json({
            records,
            isHistorical: !!isHistorical,
            tillDate: tillDate || today
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
