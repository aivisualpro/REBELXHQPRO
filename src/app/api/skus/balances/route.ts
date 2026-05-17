import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

interface BalanceCache { balanceMap: Record<string, number>; timestamp: number; }
let _cache: BalanceCache | null = null;
const CACHE_TTL = 60_000;

async function computeAllBalances(): Promise<Record<string, number>> {
    const startDate = await getGlobalStartDate();
    const df = startDate ? { createdAt: { $gte: startDate } } : {};

    const [obsAgg, posAgg, sosAgg, adjsAgg, mfgJobs, wosAgg] = await Promise.all([
        // 1. Opening Balances
        OpeningBalance.aggregate([
            { $match: { ...df } },
            { $group: { _id: { $toString: '$sku' }, qty: { $sum: '$qty' } } }
        ]),

        // 2. Purchase Orders — ALL (no status filter, matching ledger which counts all qtyReceived)
        PurchaseOrder.aggregate([
            { $match: { ...df } },
            { $unwind: '$lineItems' },
            { $group: { _id: '$lineItems.sku', qty: { $sum: '$lineItems.qtyReceived' } } }
        ]),

        // 3. Sale Orders — Shipped/Completed, qtyShipped only (matching original stock route)
        SaleOrder.aggregate([
            { $match: { orderStatus: { $in: ['Shipped', 'Completed'] }, ...df } },
            { $unwind: '$lineItems' },
            { $addFields: { 'lineItems.skuStr': { $toString: '$lineItems.sku' } } },
            { $group: { _id: '$lineItems.skuStr', qty: { $sum: '$lineItems.qtyShipped' } } }
        ]),

        // 4. Audit Adjustments
        AuditAdjustment.aggregate([
            { $match: { ...df } },
            { $addFields: { skuStr: { $toString: '$sku' } } },
            { $group: { _id: '$skuStr', netQty: { $sum: '$qty' } } }
        ]),

        // 5. Manufacturing — fetch all, apply same ledger filters in JS
        Manufacturing.find({ ...df })
            .select('sku qty qtyDifference status lineItems.sku lineItems.recipeQty lineItems.sa lineItems.qtyScrapped')
            .lean(),

        // 6. Web Orders — completed only, same $facet as original stock route (proven to work)
        WebOrder.aggregate([
            { $match: { status: { $in: ['completed', 'Completed'] }, ...df } },
            { $unwind: '$lineItems' },
            {
                $facet: {
                    multiSku: [
                        { $match: { 'lineItems.linkedSkus': { $exists: true, $ne: [] } } },
                        { $unwind: '$lineItems.linkedSkus' },
                        { $group: {
                            _id: '$lineItems.linkedSkus.skuId',
                            qty: { $sum: { $multiply: ['$lineItems.quantity', { $ifNull: ['$lineItems.linkedSkus.multiplier', 1] }] } }
                        }}
                    ],
                    singleSku: [
                        { $match: { $or: [{ 'lineItems.linkedSkus': { $exists: false } }, { 'lineItems.linkedSkus': { $size: 0 } }] } },
                        { $addFields: { resolvedSkuId: { $ifNull: ['$lineItems.linkedSkuId', null] } } },
                        { $match: { resolvedSkuId: { $ne: null } } },
                        { $group: { _id: '$resolvedSkuId', qty: { $sum: '$lineItems.quantity' } } }
                    ]
                }
            },
            { $project: { combined: { $concatArrays: ['$multiSku', '$singleSku'] } } },
            { $unwind: '$combined' },
            { $replaceRoot: { newRoot: '$combined' } },
            { $group: { _id: '$_id', qty: { $sum: '$qty' } } }
        ]),
    ]);

    const bm: Record<string, number> = {};
    const add = (id: any, qty: number) => { const k = id?.toString(); if (k) bm[k] = (bm[k] || 0) + qty; };
    const sub = (id: any, qty: number) => { const k = id?.toString(); if (k) bm[k] = (bm[k] || 0) - qty; };

    obsAgg.forEach((r: any) => add(r._id, r.qty || 0));
    posAgg.forEach((r: any) => add(r._id, r.qty || 0));
    sosAgg.forEach((r: any) => sub(r._id, r.qty || 0));
    adjsAgg.forEach((r: any) => add(r._id, r.netQty || 0));

    // Manufacturing — same filter as ledger
    (mfgJobs as any[]).forEach((mo: any) => {
        const st = (mo.status || '').toLowerCase();
        const skuId = (mo.sku?._id || mo.sku)?.toString();
        // Production (IN): exclude pending, processing, trash
        if (!['pending', 'processing', 'trash'].includes(st)) {
            add(skuId, (mo.qty || 0) + (mo.qtyDifference || 0));
        }
        // Consumption (OUT): fulfilled only
        if (st === 'fulfilled') {
            mo.lineItems?.forEach((li: any) => {
                const liId = (li.sku?._id || li.sku)?.toString();
                const bom = (mo.qty || 0) * (li.recipeQty || 0);
                const sa = (li.sa || 0) / 100;
                sub(liId, bom + (li.qtyScrapped || 0) + (sa > 0 ? (bom / sa) - bom : 0));
            });
        }
    });

    wosAgg.forEach((r: any) => sub(r._id, r.qty || 0));

    // Debug
    const DS = '698619d0dfa92e3cf7db4451';
    const dOB = obsAgg.filter((r:any)=>r._id===DS).reduce((s:number,r:any)=>s+(r.qty||0),0);
    const dPO = posAgg.filter((r:any)=>r._id?.toString()===DS).reduce((s:number,r:any)=>s+(r.qty||0),0);
    const dSO = sosAgg.filter((r:any)=>r._id===DS).reduce((s:number,r:any)=>s+(r.qty||0),0);
    const dAdj = adjsAgg.filter((r:any)=>r._id===DS).reduce((s:number,r:any)=>s+(r.netQty||0),0);
    let dMP=0,dMC=0; (mfgJobs as any[]).forEach((mo:any)=>{const st=(mo.status||'').toLowerCase();const sid=(mo.sku?._id||mo.sku)?.toString();if(!['pending','processing','trash'].includes(st)&&sid===DS)dMP+=(mo.qty||0)+(mo.qtyDifference||0);if(st==='fulfilled')mo.lineItems?.forEach((li:any)=>{if((li.sku?._id||li.sku)?.toString()===DS){const b=(mo.qty||0)*(li.recipeQty||0);const sa=(li.sa||0)/100;dMC+=b+(li.qtyScrapped||0)+(sa>0?(b/sa)-b:0);}});});
    const dWO = wosAgg.filter((r:any)=>r._id?.toString()===DS).reduce((s:number,r:any)=>s+(r.qty||0),0);
    console.log(`[BALANCE DEBUG] OB=+${dOB} PO=+${dPO} Adj=${dAdj} MfgProd=+${dMP} | SO=-${dSO} MfgCons=-${dMC} WO=-${dWO} => TOTAL=${bm[DS]}`);

    return bm;
}

export async function GET(req: Request) {
    try {
        const fresh = new URL(req.url).searchParams.get('fresh') === '1';
        if (!fresh && _cache && (Date.now() - _cache.timestamp) < CACHE_TTL) {
            return NextResponse.json({ balanceMap: _cache.balanceMap, cached: true });
        }
        await dbConnect();
        const balanceMap = await computeAllBalances();
        _cache = { balanceMap, timestamp: Date.now() };
        return NextResponse.json({ balanceMap, cached: false });
    } catch (error: any) {
        console.error('Balance error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
