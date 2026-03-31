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

        // Optimization: Do NOT pass an array of 5,000+ SKUs to the database if we are pulling all active inventory.
        // It massively throttles Mongo. Let Mongo group over the entire collection naturally.
        const obMatch = skuFilter ? { sku: { $in: dualSkuIds }, ...transactionQuery } : { ...transactionQuery };
        const poMatch = skuFilter ? { "lineItems.sku": { $in: skuIds }, status: "Received", ...transactionQuery } : { status: "Received", ...transactionQuery };
        const poLineMatch = skuFilter ? { "lineItems.sku": { $in: skuIds } } : {};
        const soMatch = skuFilter ? { "lineItems.sku": { $in: dualSkuIds }, ...transactionQuery } : { ...transactionQuery };
        const soLineMatch = skuFilter ? { "lineItems.sku": { $in: dualSkuIds } } : {};
        const moProdMatch = skuFilter ? { sku: { $in: skuIds }, status: { $ne: 'Pending' }, ...transactionQuery } : { status: { $ne: 'Pending' }, ...transactionQuery };
        const moConsMatch = skuFilter ? { "lineItems.sku": { $in: skuIds }, status: 'Fulfilled', ...transactionQuery } : { status: 'Fulfilled', ...transactionQuery };
        const adjMatch = skuFilter ? { sku: { $in: dualSkuIds }, ...transactionQuery } : { ...transactionQuery };
        
        const woMatchBase = {
            status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'] },
            ...(tillDateParam ? { dateCreated: { $lte: new Date(tillDateParam + 'T23:59:59.999Z') } } : {})
        };
        const woMatch = skuFilter ? {
            $or: [
                { "lineItems.sku": { $in: skuIds } },
                { "lineItems.linkedSkuId": { $in: strSkuIds } },
                { "lineItems.linkedSkus.skuId": { $in: strSkuIds } }
            ], ...woMatchBase
        } : woMatchBase;

        const woLineMatch = skuFilter ? {
            $or: [
                { "lineItems.sku": { $in: skuIds } },
                { "lineItems.linkedSkuId": { $in: strSkuIds } },
                { "lineItems.linkedSkus.skuId": { $in: strSkuIds } }
            ]
        } : {};

        const woMultiSkuMatch = skuFilter ? { "lineItems.linkedSkus.skuId": { $in: strSkuIds } } : {};
        
        const woVarMatch = skuFilter ? { "lineItems.varianceId": { $in: allVariances }, ...woMatchBase } : woMatchBase;
        const woVarLineMatch = skuFilter ? { "lineItems.varianceId": { $in: allVariances } } : {};

        // Fetch Collections fast via find().lean() rather than heavy Mongo disk $unwind
        const [
            obsRaw,
            posRaw,
            sosRaw,
            mosProdAgg,
            mosConsAgg,
            adjsRaw,
            wosRaw
        ] = await Promise.all([
            OpeningBalance.find(obMatch).select('sku qty cost').lean(),
            PurchaseOrder.find(poMatch).select('lineItems').lean(),
            SaleOrder.find(soMatch).select('lineItems orderStatus').lean(),
            Manufacturing.find(moProdMatch).select('sku qty qtyDifference lineItems labor status').lean(),
            Manufacturing.find(moConsMatch).select('lineItems qty status').lean(),
            AuditAdjustment.find(adjMatch).select('sku qty cost').lean(),
            WebOrder.find(woMatchBase).select('lineItems status dateCreated').lean()
        ]);

        const obsMap = new Map(); 
        obsRaw.forEach((r: any) => {
            if(!r.sku) return;
            const id = r.sku.toString();
            const ex = obsMap.get(id) || { qty: 0, costVal: 0 };
            ex.qty += (r.qty || 0);
            ex.costVal += (r.qty || 0) * (r.cost || 0);
            obsMap.set(id, ex);
        });
        
        const posMap = new Map(); 
        posRaw.forEach((po: any) => {
            po.lineItems?.forEach((li: any) => {
                if(!li.sku) return;
                const id = li.sku.toString();
                const ex = posMap.get(id) || { qty: 0, costVal: 0 };
                ex.qty += (li.qtyReceived || 0);
                ex.costVal += (li.qtyReceived || 0) * (li.cost || 0);
                posMap.set(id, ex);
            });
        });

        const sosMap = new Map(); 
        sosRaw.forEach((so: any) => {
            if(so.orderStatus !== 'Shipped' && so.orderStatus !== 'Completed') return;
            so.lineItems?.forEach((li: any) => {
                if(!li.sku) return;
                const id = li.sku.toString();
                const ex = sosMap.get(id) || { qty: 0 };
                ex.qty += (li.qtyShipped || 0);
                sosMap.set(id, ex);
            });
        });

        const adjsMap = new Map(); 
        adjsRaw.forEach((r: any) => {
            if(!r.sku) return;
            const id = r.sku.toString();
            const ex = adjsMap.get(id) || { netQty: 0, costVal: 0 };
            ex.netQty += (r.qty || 0);
            ex.costVal += (r.qty || 0) * (r.cost || 0);
            adjsMap.set(id, ex);
        });

        const wosSkuMap = new Map(); 
        const wosVarMap = new Map(); 
        
        wosRaw.forEach((wo: any) => {
            wo.lineItems?.forEach((li: any) => {
                let qty = li.quantity || 0;
                
                // Track by variance (for variances loop later)
                if (li.varianceId) {
                    const vid = li.varianceId.toString();
                    const exV = wosVarMap.get(vid) || { qty: 0 };
                    exV.qty += qty;
                    wosVarMap.set(vid, exV);
                }

                // Track by SKU (multi-link vs single-link)
                if (li.linkedSkus && li.linkedSkus.length > 0) {
                    li.linkedSkus.forEach((ls: any) => {
                        if (ls.skuId) {
                            const sid = ls.skuId.toString();
                            const lsQty = qty * (ls.multiplier || 1);
                            const ex = wosSkuMap.get(sid) || { qty: 0 };
                            ex.qty += lsQty;
                            wosSkuMap.set(sid, ex);
                        }
                    });
                } else {
                    const sid = (li.linkedSkuId || li.sku)?.toString();
                    if (sid) {
                        const ex = wosSkuMap.get(sid) || { qty: 0 };
                        ex.qty += qty;
                        wosSkuMap.set(sid, ex);
                    }
                }
            });
        });

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

        if (ingredientKeys.size > 0 || !skuFilter) {
            const obIngMatch = skuFilter ? {
                sku: { $in: Array.from(ingredientKeys).map(k => k.split(':')[0]) },
                lotNumber: { $in: Array.from(ingredientKeys).map(k => k.split(':')[1]) }
            } : {};
            
            const poIngMatch = skuFilter ? {
                "lineItems": { $elemMatch: { sku: { $in: Array.from(ingredientKeys).map(k => k.split(':')[0]) }, lotNumber: { $in: Array.from(ingredientKeys).map(k => k.split(':')[1]) } } },
                status: 'Received'
            } : { status: 'Received' };

            [ingObs, ingPos] = await Promise.all([
                OpeningBalance.find(obIngMatch).select('sku lotNumber cost').lean(),
                PurchaseOrder.find(poIngMatch).select('lineItems status').lean()
            ]);
        }

        const obCostMap = new Map();
        ingObs.forEach(ob => {
            if(ob.sku && ob.lotNumber) obCostMap.set(`${ob.sku.toString()}:${ob.lotNumber}`, ob.cost || 0);
        });

        const poCostMap = new Map();
        ingPos.forEach(po => {
            po.lineItems?.forEach((li: any) => {
                const lSku = li.sku?._id || li.sku;
                if(lSku && li.lotNumber && !poCostMap.has(`${lSku.toString()}:${li.lotNumber}`)) {
                    poCostMap.set(`${lSku.toString()}:${li.lotNumber}`, li.cost || 0);
                }
            });
        });

        const getLotCostBulk = (skuId: string, lot: string) => {
            const key = `${skuId}:${lot}`;
            if (obCostMap.has(key)) return obCostMap.get(key);
            if (poCostMap.has(key)) return poCostMap.get(key);
            return 0;
        };

        const moProdMap = new Map();
        (mosProdAgg as any[]).forEach(m => {
            const SkuIdStr = m.sku?.toString();
            if (SkuIdStr) {
                if (!moProdMap.has(SkuIdStr)) moProdMap.set(SkuIdStr, []);
                moProdMap.get(SkuIdStr).push(m);
            }
        });

        const moConsMap = new Map();
        (mosConsAgg as any[]).forEach(m => {
            m.lineItems?.forEach((li: any) => {
                const liSkuIdStr = (li.sku?._id || li.sku)?.toString();
                if (liSkuIdStr) {
                    if (!moConsMap.has(liSkuIdStr)) moConsMap.set(liSkuIdStr, []);
                    moConsMap.get(liSkuIdStr).push({ mo: m, li });
                }
            });
        });

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

            const myMos = moProdMap.get(id) || [];
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

            const myConsMosItems = moConsMap.get(id) || [];
            myConsMosItems.forEach(({ mo, li }: any) => {
                const bomQty = (mo.qty || 0) * (li.recipeQty || 0);
                const saPercent = li.sa || 0;
                const sa = saPercent / 100;
                const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                const qtyScrapped = li.qtyScrapped || 0;
                qtyOut += bomQty + qtyScrapped + qtyExtra;
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
