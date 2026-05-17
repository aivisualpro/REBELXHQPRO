import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';

export const dynamic = 'force-dynamic';

// ─── Global in-memory cache ──────────────────────────────────────────────────
// Shared across all requests. M10 Atlas benefits: aggregations run on dedicated
// server-side resources with indexed collections, then results are cached here.

interface StockCache {
    stockMap: Record<string, number>;
    timestamp: number;
}

let _stockCache: StockCache | null = null;
const CACHE_TTL = 60_000; // 60 seconds

// ─── Stock Computation ───────────────────────────────────────────────────────

async function computeAllStockQuantities(): Promise<Record<string, number>> {
    console.time('stock-compute');

    const { ObjectId } = mongoose.Types;

    // Fire ALL aggregations in parallel — M10 Atlas handles concurrent ops well
    const [
        obsAgg,
        posAgg,
        sosAgg,
        adjsAgg,
        mosProd,
        mosCons,
        wosSkuAgg,
    ] = await Promise.all([
        // 1. Opening Balances — sum qty per SKU
        OpeningBalance.aggregate([
            { $addFields: { skuStr: { $toString: '$sku' } } },
            { $group: { _id: '$skuStr', qty: { $sum: '$qty' } } }
        ]),

        // 2. Purchase Orders (Received only) — sum qtyReceived per SKU
        PurchaseOrder.aggregate([
            { $match: { status: 'Received' } },
            { $unwind: '$lineItems' },
            { $group: { _id: '$lineItems.sku', qty: { $sum: '$lineItems.qtyReceived' } } }
        ]),

        // 3. Sale Orders (Shipped/Completed) — sum qtyShipped per SKU
        SaleOrder.aggregate([
            { $match: { orderStatus: { $in: ['Shipped', 'Completed'] } } },
            { $unwind: '$lineItems' },
            { $addFields: { 'lineItems.skuStr': { $toString: '$lineItems.sku' } } },
            { $group: { _id: '$lineItems.skuStr', qty: { $sum: '$lineItems.qtyShipped' } } }
        ]),

        // 4. Audit Adjustments — sum net qty per SKU
        AuditAdjustment.aggregate([
            { $addFields: { skuStr: { $toString: '$sku' } } },
            { $group: { _id: '$skuStr', netQty: { $sum: '$qty' } } }
        ]),

        // 5. Manufacturing — Production (non-Pending): fetch for Node.js processing
        Manufacturing.find({ status: { $nin: ['Pending'] } })
            .select('sku qty qtyDifference status')
            .lean(),

        // 6. Manufacturing — Consumption (Fulfilled only): fetch for Node.js processing
        Manufacturing.find({ status: 'Fulfilled' })
            .select('lineItems.sku lineItems.recipeQty lineItems.sa lineItems.qtyScrapped qty status')
            .lean(),

        // 7. Web Orders — sum quantity per SKU (direct + linkedSkuId + linkedSkus)
        WebOrder.aggregate([
            {
                $match: {
                    status: { $in: ['completed', 'Completed'] }
                }
            },
            { $unwind: '$lineItems' },
            {
                $facet: {
                    // Branch A: linkedSkus array (multi-SKU)
                    multiSku: [
                        { $match: { 'lineItems.linkedSkus': { $exists: true, $ne: [] } } },
                        { $unwind: '$lineItems.linkedSkus' },
                        {
                            $group: {
                                _id: '$lineItems.linkedSkus.skuId',
                                qty: { $sum: { $multiply: ['$lineItems.quantity', { $ifNull: ['$lineItems.linkedSkus.multiplier', 1] }] } }
                            }
                        }
                    ],
                    // Branch B: single-link (sku or linkedSkuId)
                    singleSku: [
                        { $match: { $or: [{ 'lineItems.linkedSkus': { $exists: false } }, { 'lineItems.linkedSkus': { $size: 0 } }] } },
                        {
                            $addFields: {
                                resolvedSkuId: { $ifNull: ['$lineItems.linkedSkuId', { $ifNull: ['$lineItems.sku', null] }] }
                            }
                        },
                        {
                            $group: {
                                _id: '$resolvedSkuId',
                                qty: { $sum: '$lineItems.quantity' }
                            }
                        }
                    ]
                }
            },
            { $project: { combined: { $concatArrays: ['$multiSku', '$singleSku'] } } },
            { $unwind: '$combined' },
            { $replaceRoot: { newRoot: '$combined' } },
            { $group: { _id: '$_id', qty: { $sum: '$qty' } } }
        ]),
    ]);

    // ─── Build stock map ─────────────────────────────────────────────────────

    const stockMap: Record<string, number> = {};

    const addStock = (id: string, qty: number) => {
        if (!id) return;
        stockMap[id] = (stockMap[id] || 0) + qty;
    };

    const subStock = (id: string, qty: number) => {
        if (!id) return;
        stockMap[id] = (stockMap[id] || 0) - qty;
    };

    // 1. Opening Balances (IN)
    obsAgg.forEach((r: any) => addStock(r._id, r.qty || 0));

    // 2. Purchase Orders (IN)
    posAgg.forEach((r: any) => addStock(r._id?.toString(), r.qty || 0));

    // 3. Sale Orders (OUT)
    sosAgg.forEach((r: any) => subStock(r._id, r.qty || 0));

    // 4. Audit Adjustments (IN or OUT depending on sign)
    adjsAgg.forEach((r: any) => addStock(r._id, r.netQty || 0));

    // 5. Manufacturing — Production (IN)
    (mosProd as any[]).forEach((mo: any) => {
        const skuId = (mo.sku?._id || mo.sku)?.toString();
        if (!skuId) return;
        const qty = (mo.qty || 0) + (mo.qtyDifference || 0);
        addStock(skuId, qty);
    });

    // 6. Manufacturing — Consumption (OUT)
    (mosCons as any[]).forEach((mo: any) => {
        mo.lineItems?.forEach((li: any) => {
            const skuId = (li.sku?._id || li.sku)?.toString();
            if (!skuId) return;

            const orderQty = mo.qty || 0;
            const recipeQty = li.recipeQty || 0;
            const bomQty = orderQty * recipeQty;
            const saPercent = li.sa || 0;
            const sa = saPercent / 100;
            const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
            const qtyScrapped = li.qtyScrapped || 0;
            const totalConsumed = bomQty + qtyScrapped + qtyExtra;

            subStock(skuId, totalConsumed);
        });
    });

    // 7. Web Orders (OUT)
    wosSkuAgg.forEach((r: any) => subStock(r._id?.toString(), r.qty || 0));

    // ─── DEBUG ───
    const DS = '698619d0dfa92e3cf7db4451';
    const dOB = obsAgg.filter((r:any)=>r._id===DS).reduce((s:number,r:any)=>s+(r.qty||0),0);
    const dPO = posAgg.filter((r:any)=>r._id?.toString()===DS).reduce((s:number,r:any)=>s+(r.qty||0),0);
    const dSO = sosAgg.filter((r:any)=>r._id===DS).reduce((s:number,r:any)=>s+(r.qty||0),0);
    const dAdj = adjsAgg.filter((r:any)=>r._id===DS).reduce((s:number,r:any)=>s+(r.netQty||0),0);
    let dMP=0; (mosProd as any[]).forEach((mo:any)=>{if((mo.sku?._id||mo.sku)?.toString()===DS) dMP+=(mo.qty||0)+(mo.qtyDifference||0);});
    let dMC=0; (mosCons as any[]).forEach((mo:any)=>{mo.lineItems?.forEach((li:any)=>{if((li.sku?._id||li.sku)?.toString()===DS){const b=(mo.qty||0)*(li.recipeQty||0);const sa=(li.sa||0)/100;dMC+=b+(li.qtyScrapped||0)+(sa>0?(b/sa)-b:0);}});});
    const dWO = wosSkuAgg.filter((r:any)=>r._id?.toString()===DS).reduce((s:number,r:any)=>s+(r.qty||0),0);
    console.log(`[STOCK DEBUG] OB=+${dOB} PO=+${dPO} SO=-${dSO} Adj=${dAdj} MfgProd=+${dMP} MfgCons=-${dMC} WO=-${dWO} => TOTAL=${stockMap[DS]}`);
    // ─── END DEBUG ───

    console.timeEnd('stock-compute');
    return stockMap;
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fresh = searchParams.get('fresh') === '1';
        // Check cache first — return instantly if fresh
        if (!fresh && _stockCache && (Date.now() - _stockCache.timestamp) < CACHE_TTL) {
            return NextResponse.json({
                stockMap: _stockCache.stockMap,
                cached: true,
                age: Math.round((Date.now() - _stockCache.timestamp) / 1000),
            });
        }

        await dbConnect();

        const stockMap = await computeAllStockQuantities();

        // Cache the result
        _stockCache = { stockMap, timestamp: Date.now() };

        return NextResponse.json({
            stockMap,
            cached: false,
            skuCount: Object.keys(stockMap).length,
        });
    } catch (error: any) {
        console.error('Stock computation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
