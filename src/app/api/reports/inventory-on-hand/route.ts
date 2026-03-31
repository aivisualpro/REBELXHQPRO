import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);

        const tillDateParam = searchParams.get('tillDate');
        const skuFilter = searchParams.get('sku');
        const showAllParam = searchParams.get('showAll');

        let transactionQuery: any = {};
        if (tillDateParam) {
            const tillEnd = new Date(tillDateParam + 'T23:59:59.999Z');
            transactionQuery.createdAt = { $lte: tillEnd };
        }

        let skuQuery: any = { isArchived: { $ne: true } };
        if (skuFilter) {
            skuQuery._id = skuFilter;
        }

        const skusRaw = await Sku.find(skuQuery).lean();
        const skuIds = skusRaw.map((s: any) => s._id);
        const strSkuIds = skusRaw.map((s: any) => s._id.toString());
        const allVariances = skusRaw.flatMap((s: any) => s.variances?.map((v: any) => v._id) || []);

        const dualSkuIds = [
            ...strSkuIds,
            ...strSkuIds.filter((id: string) => ObjectId.isValid(id)).map((id: string) => new ObjectId(id))
        ];

        // Fetch Aggregations
        const [
            obsAgg,
            posAgg,
            sosAgg,
            mosProdAgg,
            mosConsAgg,
            adjsAgg,
            wosSkuAgg,
            wosVarAgg
        ] = await Promise.all([
            // 1. OBs
            OpeningBalance.aggregate([
                { $match: { sku: { $in: dualSkuIds }, ...transactionQuery } },
                { $addFields: { skuStr: { $toString: "$sku" } } },
                {
                    $group: {
                        _id: "$skuStr",
                        qty: { $sum: "$qty" },
                        costVal: { $sum: { $multiply: ["$qty", "$cost"] } }
                    }
                }
            ]),
            // 2. POs
            PurchaseOrder.aggregate([
                { $match: { "lineItems.sku": { $in: skuIds }, status: "Received", ...transactionQuery } },
                { $unwind: "$lineItems" },
                { $match: { "lineItems.sku": { $in: skuIds } } },
                {
                    $group: {
                        _id: "$lineItems.sku",
                        qty: { $sum: "$lineItems.qtyReceived" },
                        costVal: { $sum: { $multiply: ["$lineItems.qtyReceived", "$lineItems.cost"] } }
                    }
                }
            ]),
            // 3. SOs
            SaleOrder.aggregate([
                { $match: { "lineItems.sku": { $in: dualSkuIds }, ...transactionQuery } },
                { $unwind: "$lineItems" },
                { $match: { "lineItems.sku": { $in: dualSkuIds } } },
                { $match: { orderStatus: { $in: ['Shipped', 'Completed'] } } },
                { $addFields: { "lineItems.skuStr": { $toString: "$lineItems.sku" } } },
                {
                    $group: {
                        _id: "$lineItems.skuStr",
                        qty: { $sum: "$lineItems.qtyShipped" }
                    }
                }
            ]),
            // 4. MOs Prod
            Manufacturing.find({ sku: { $in: skuIds }, status: { $ne: 'Pending' }, ...transactionQuery })
                .select('sku qty qtyDifference lineItems labor status')
                .lean(),
            // 5. MOs Cons
            Manufacturing.find({ "lineItems.sku": { $in: skuIds }, status: 'Fulfilled', ...transactionQuery })
                .select('lineItems qty status')
                .lean(),
            // 6. Adjs
            AuditAdjustment.aggregate([
                { $match: { sku: { $in: dualSkuIds }, ...transactionQuery } },
                { $addFields: { skuStr: { $toString: "$sku" } } },
                {
                    $group: {
                        _id: "$skuStr",
                        netQty: { $sum: "$qty" },
                        costVal: { $sum: { $multiply: ["$qty", "$cost"] } }
                    }
                }
            ]),
            // 7. WebOrders Sku
            WebOrder.aggregate([
                {
                    $match: {
                        $or: [
                            { "lineItems.sku": { $in: skuIds } },
                            { "lineItems.linkedSkuId": { $in: strSkuIds } },
                            { "lineItems.linkedSkus.skuId": { $in: strSkuIds } }
                        ],
                        status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'] },
                        // WebOrder uses dateCreated for filtering generally
                        ...(tillDateParam ? { dateCreated: { $lte: new Date(tillDateParam + 'T23:59:59.999Z') } } : {})
                    }
                },
                { $unwind: "$lineItems" },
                {
                    $match: {
                        $or: [
                            { "lineItems.sku": { $in: skuIds } },
                            { "lineItems.linkedSkuId": { $in: strSkuIds } },
                            { "lineItems.linkedSkus.skuId": { $in: strSkuIds } }
                        ]
                    }
                },
                {
                    $facet: {
                        multiSku: [
                            { $match: { "lineItems.linkedSkus": { $exists: true, $ne: [] } } },
                            { $unwind: "$lineItems.linkedSkus" },
                            { $match: { "lineItems.linkedSkus.skuId": { $in: strSkuIds } } },
                            { $group: { _id: "$lineItems.linkedSkus.skuId", qty: { $sum: { $multiply: ["$lineItems.quantity", { $ifNull: ["$lineItems.linkedSkus.multiplier", 1] }] } } } }
                        ],
                        singleSku: [
                            { $match: { $or: [{ "lineItems.linkedSkus": { $exists: false } }, { "lineItems.linkedSkus": { $size: 0 } }] } },
                            { $addFields: { resolvedSkuId: { $ifNull: ["$lineItems.linkedSkuId", { $ifNull: ["$lineItems.sku", null] }] } } },
                            { $group: { _id: "$resolvedSkuId", qty: { $sum: "$lineItems.quantity" } } }
                        ]
                    }
                },
                { $project: { combined: { $concatArrays: ["$multiSku", "$singleSku"] } } },
                { $unwind: "$combined" },
                { $replaceRoot: { newRoot: "$combined" } },
                { $group: { _id: "$_id", qty: { $sum: "$qty" } } }
            ]),
            // 8. WebOrders Var
            WebOrder.aggregate([
                {
                    $match: {
                        "lineItems.varianceId": { $in: allVariances },
                        status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'] },
                        ...(tillDateParam ? { dateCreated: { $lte: new Date(tillDateParam + 'T23:59:59.999Z') } } : {})
                    }
                },
                { $unwind: "$lineItems" },
                { $match: { "lineItems.varianceId": { $in: allVariances } } },
                { $group: { _id: "$lineItems.varianceId", qty: { $sum: "$lineItems.quantity" } } }
            ])
        ]);

        const obsMap = new Map(); obsAgg.forEach((r: any) => obsMap.set(r._id, r));
        const posMap = new Map(); posAgg.forEach((r: any) => posMap.set(r._id, r));
        const sosMap = new Map(); sosAgg.forEach((r: any) => sosMap.set(r._id, r));
        const adjsMap = new Map(); adjsAgg.forEach((r: any) => adjsMap.set(r._id, r));
        const wosSkuMap = new Map(); wosSkuAgg.forEach((r: any) => wosSkuMap.set(r._id, r));
        const wosVarMap = new Map(); wosVarAgg.forEach((r: any) => wosVarMap.set(r._id, r));

        // Manufacturing Ingredient cost mapping
        const ingredientKeys: Set<string> = new Set();
        (mosProdAgg as any[]).forEach((mo: any) => {
            mo.lineItems?.forEach((li: any) => {
                const liSkuId = (li.sku?._id || li.sku);
                if (liSkuId && li.lotNumber) ingredientKeys.add(`${liSkuId}:${li.lotNumber}`);
            });
        });

        let ingObs: any[] = [];
        let ingPos: any[] = [];

        if (ingredientKeys.size > 0) {
            [ingObs, ingPos] = await Promise.all([
                OpeningBalance.find({
                    sku: { $in: Array.from(ingredientKeys).map(k => k.split(':')[0]) },
                    lotNumber: { $in: Array.from(ingredientKeys).map(k => k.split(':')[1]) }
                }).select('sku lotNumber cost').lean(),
                PurchaseOrder.find({
                    "lineItems": { $elemMatch: { sku: { $in: Array.from(ingredientKeys).map(k => k.split(':')[0]) }, lotNumber: { $in: Array.from(ingredientKeys).map(k => k.split(':')[1]) } } },
                    status: 'Received'
                }).select('lineItems status').lean()
            ]);
        }

        const getLotCostBulk = (skuId: string, lot: string) => {
            const ob = ingObs.find(o => o.sku.toString() === skuId && o.lotNumber === lot);
            if (ob) return ob.cost || 0;
            for (const po of ingPos) {
                const line = (po as any).lineItems.find((l: any) => {
                    const lSku = l.sku?._id || l.sku;
                    return lSku?.toString() === skuId && l.lotNumber === lot;
                });
                if (line) return line.cost || 0;
            }
            return 0;
        };

        const resultSkus = skusRaw.map((sku: any) => {
            const id = sku._id.toString();
            const varianceIds = sku.variances?.map((v: any) => v._id) || [];

            let qtyIn = 0;
            let qtyOut = 0;
            let totalCostIn = 0;

            const obData = obsMap.get(id);
            if (obData) {
                qtyIn += obData.qty || 0;
                totalCostIn += obData.costVal || 0;
            }

            const poData = posMap.get(id);
            if (poData) {
                qtyIn += poData.qty || 0;
                totalCostIn += poData.costVal || 0;
            }

            const myMos = (mosProdAgg as any[]).filter((m: any) => m.sku?.toString() === id);
            myMos.forEach((mo: any) => {
                const qty = (mo.qty || 0) + (mo.qtyDifference || 0);
                qtyIn += qty;

                let moCost = 0;
                mo.lineItems?.forEach((li: any) => {
                    const liSkuId = (li.sku?._id || li.sku);
                    const bomQty = (mo.qty || 0) * (li.recipeQty || 0);
                    const saPercent = li.sa || 0;
                    const sa = saPercent / 100;
                    const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                    const qtyScrapped = li.qtyScrapped || 0;
                    const liQty = bomQty + qtyScrapped + qtyExtra;
                    const unitCost = li.cost || getLotCostBulk(liSkuId?.toString(), li.lotNumber);
                    moCost += liQty * unitCost;
                });
                mo.labor?.forEach((lab: any) => {
                    const parts = (lab.duration || '0:0:0').split(':');
                    const hours = parseInt(parts[0] || '0') + parseInt(parts[1] || '0') / 60 + parseInt(parts[2] || '0') / 3600;
                    moCost += hours * (lab.hourlyRate || 0);
                });

                if (qty > 0) totalCostIn += moCost;
            });

            const myConsMos = (mosConsAgg as any[]).filter((m: any) => m.lineItems.some((li: any) => (li.sku?._id || li.sku)?.toString() === id));
            myConsMos.forEach((mo: any) => {
                const matchingLines = mo.lineItems.filter((l: any) => (l.sku?._id || l.sku)?.toString() === id);
                matchingLines.forEach((li: any) => {
                    const bomQty = (mo.qty || 0) * (li.recipeQty || 0);
                    const saPercent = li.sa || 0;
                    const sa = saPercent / 100;
                    const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                    const qtyScrapped = li.qtyScrapped || 0;
                    qtyOut += bomQty + qtyScrapped + qtyExtra;
                });
            });

            const adjData = adjsMap.get(id);
            if (adjData) {
                const netAdj = adjData.netQty || 0;
                if (netAdj > 0) {
                    qtyIn += netAdj;
                    totalCostIn += adjData.costVal || 0;
                } else {
                    qtyOut += Math.abs(netAdj);
                }
            }

            const soData = sosMap.get(id);
            if (soData) qtyOut += soData.qty || 0;

            const woSku = wosSkuMap.get(id);
            if (woSku) qtyOut += woSku.qty || 0;

            varianceIds.forEach((vid: string) => {
                const woVar = wosVarMap.get(vid);
                if (woVar) qtyOut += woVar.qty || 0;
            });

            const currentQty = qtyIn - qtyOut;
            const avgCost = qtyIn > 0 ? totalCostIn / qtyIn : 0;
            const totalCost = currentQty > 0 ? currentQty * avgCost : 0;

            return {
                id,
                name: sku.name,
                category: sku.category || 'Uncategorized',
                subCategory: sku.subCategory || 'Uncategorized',
                uom: sku.uom || '',
                availableQty: currentQty,
                reOrderPoint: sku.reOrderPoint || 0,
                orderUpto: sku.orderUpto || 0,
                avgCost,
                totalCost
            };
        });

        // Filter out zero-stock if showAll is not provided
        const finalInventory = showAllParam === 'true' 
            ? resultSkus 
            : resultSkus.filter((s:any) => s.availableQty > 0);

        return NextResponse.json({
            records: finalInventory
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
