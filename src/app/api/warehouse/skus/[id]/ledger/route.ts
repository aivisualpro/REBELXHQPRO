import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import Client from '@/models/Client';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';
import WebProduct from '@/models/WebProduct';
import Vendor from '@/models/Vendor';
import Setting from '@/models/Setting';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

// ⚡ In-memory cache for SKU ledger responses (1s TTL - microcache for React Strict Mode duplicate calls)
const CACHE_TTL = 1_000; // 1 second
const ledgerCache = new Map<string, { data: any; timestamp: number }>();

// Periodic cleanup to prevent memory leaks (every 5 min)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of ledgerCache) {
        if (now - entry.timestamp > CACHE_TTL * 4) ledgerCache.delete(key);
    }
}, 300_000);

// Helper to round to max 8 decimal places for cleaner display
const round8 = (num: number): number => Math.round(num * 100000000) / 100000000;

// Helper to clean lot numbers — strips locale formatting (commas, trailing .00)
const cleanLot = (lot: any): string => {
    if (lot === null || lot === undefined) return '';
    let s = String(lot).trim();
    // Remove commas (locale formatting)
    s = s.replace(/,/g, '');
    // Remove trailing .00 or .0 (numeric artifact)
    s = s.replace(/\.0+$/, '');
    return s;
};

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        console.time('ledger-route');

        const { id } = await context.params;

        // ⚡ Check in-memory cache first (1s TTL)
        const bustCache = request.nextUrl.searchParams.get('bust') === '1';
        const lotsOnly = request.nextUrl.searchParams.get('lotsOnly') === '1';
        const cached = ledgerCache.get(id);
        if (!bustCache && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            console.timeEnd('ledger-route');
            return NextResponse.json(cached.data);
        }

        await dbConnect();

        // Ensure models are registered
        void Client;
        void AuditAdjustment;
        void Vendor;

        // Try both ObjectId and String _id lookups to handle both storage formats
        let sku: any = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            const db = mongoose.connection.db;
            const collection = db?.collection('skus');
            if (collection) {
                sku = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) as any });
            }
        }
        // Fallback: try string _id (CSV imports store _id as string)
        if (!sku) {
            sku = await Sku.findOne({ _id: id }).lean();
        }

        // Get settings in parallel (skip settings fetch for lotsOnly)
        const [startDate, settings] = await Promise.all([
            getGlobalStartDate(),
            lotsOnly ? Promise.resolve(null) : Setting.findOne({ key: 'missingSkuImage' }).select('value').lean()
        ]);

        if (!sku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        const varianceIds = sku.variances?.map((v: any) => v._id) || [];
        const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};
        // Cast to ObjectId for aggregation $filter (Mongoose .find() auto-casts, aggregation does NOT)
        const skuOid = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
        const skuMatch = { $in: [skuOid, id] };

        // ⚡ ROCKET: Fire ALL queries in a SINGLE parallel batch
        const timePipeline = async (name: string, promise: any) => {
            console.time(name);
            const res = await promise;
            console.timeEnd(name);
            return res;
        };

        // Kick off immediate standalone queries
        const webProductsPromise = timePipeline('b1-webproduct', WebProduct.find({
            $or: [
                { linkedSkuId: skuMatch },
                { 'variations.linkedSkuId': skuMatch },
                { 'linkedSkus.skuId': skuMatch },
                { 'variations.linkedSkus.skuId': skuMatch }
            ]
        } as any)
            .select('_id webId website multiplier variations.id variations._id variations.multiplier variations.linkedSkuId variations.linkedSkus linkedSkuId linkedSkus')
            .lean());

        const rawManufacturingJobsPromise = timePipeline('b1-manufacturing', Manufacturing.find({ $or: [{ sku: skuMatch }, { "lineItems.sku": skuMatch }], ...dateFilter } as any)
            .select('_id sku qty qtyDifference uom lotNumber label scheduledStart scheduledFinish createdAt lineItems labor totalCost packagingCost status')
            .lean());

        const openingBalancesPromise = timePipeline('b1-openingbalance', OpeningBalance.aggregate([
            { $match: { sku: skuMatch, ...dateFilter } },
            { $sort: { createdAt: 1 } },
            { $project: { _id: 1, createdAt: 1, lotNumber: 1, qty: 1, uom: 1, cost: 1 } }
        ]));

        const purchaseOrdersPromise = timePipeline('b1-purchaseorder', PurchaseOrder.aggregate([
            { $match: { "lineItems.sku": skuMatch, ...dateFilter } },
            { $unwind: "$lineItems" },
            { $match: { "lineItems.sku": skuMatch } },
            { $sort: { createdAt: 1 } },
            { $project: {
                _id: 1, label: 1, createdAt: 1, receivedDate: 1, status: 1,
                lineItems: [{
                    _id: "$lineItems._id", sku: "$lineItems.sku", qtyReceived: "$lineItems.qtyReceived", lotNumber: "$lineItems.lotNumber", uom: "$lineItems.uom", price: "$lineItems.price",
                    cost: { $cond: [{ $and: [{ $ne: ["$lineItems.cost", null] }, { $ne: ["$lineItems.cost", 0] }] }, "$lineItems.cost", "$lineItems.price"] }
                }]
            }}
        ]));

        const saleOrdersPromise = timePipeline('b1-saleorder', SaleOrder.aggregate([
            { $match: { "lineItems.sku": skuMatch, ...dateFilter } },
            { $unwind: "$lineItems" },
            { $match: { "lineItems.sku": skuMatch } },
            { $sort: { createdAt: 1 } },
            { $project: {
                _id: 1, label: 1, createdAt: 1, shippedDate: 1, orderStatus: 1,
                lineItems: [{
                    _id: "$lineItems._id", sku: "$lineItems.sku", qty: "$lineItems.qty", lotNumber: "$lineItems.lotNumber", uom: "$lineItems.uom", cost: "$lineItems.cost", price: "$lineItems.price",
                    qtyShipped: {
                        $cond: [
                            { $and: [{ $ne: ["$lineItems.qtyShipped", null] }, { $ne: ["$lineItems.qtyShipped", 0] }] },
                            "$lineItems.qtyShipped",
                            { $ifNull: ["$lineItems.qty", 0] }
                        ]
                    }
                }]
            }}
        ]));

        const adjustmentsPromise = timePipeline('b1-auditadjustment', AuditAdjustment.aggregate([
            { $match: { sku: skuMatch, ...dateFilter } },
            { $sort: { createdAt: 1 } },
            { $project: { _id: 1, createdAt: 1, reference: 1, lotNumber: 1, qty: 1, cost: 1, status: 1 } }
        ]));

        // Chain merged web orders off webProductsPromise
        const webOrdersPromise = webProductsPromise.then((webProducts: any) => {
            const wpWebIds = webProducts.map((wp: any) => wp.webId).filter(Boolean);
            const wpWebsites = [...new Set(webProducts.map((wp: any) => wp.website).filter(Boolean))];
            
            const matchOr: any[] = [
                { "lineItems.sku": skuMatch },
                { "lineItems.varianceId": { $in: varianceIds } },
                { "lineItems.linkedSkuId": skuMatch },
                { "lineItems.linkedSkus.skuId": skuMatch }
            ];
            if (wpWebIds.length > 0) {
                matchOr.push({ "lineItems.productId": { $in: wpWebIds }, website: { $in: wpWebsites } });
            }

            const innerMatchOr: any[] = [
                { "lineItems.sku": skuMatch },
                { "lineItems.varianceId": { $in: varianceIds } },
                { "lineItems.linkedSkuId": skuMatch },
                { "lineItems.linkedSkus.skuId": skuMatch }
            ];
            if (wpWebIds.length > 0) {
                innerMatchOr.push({ "lineItems.productId": { $in: wpWebIds } });
            }

            return timePipeline('merged-weborder', WebOrder.aggregate([
                { $match: { $or: matchOr, ...dateFilter } },
                { $unwind: "$lineItems" },
                { $match: { $or: innerMatchOr } },
                { $sort: { createdAt: 1 } },
                { $project: {
                    _id: 1, createdAt: 1, dateCompleted: 1, status: 1, website: 1,
                    lineItems: [{
                        _id: "$lineItems._id", id: "$lineItems.id", sku: "$lineItems.sku", linkedSkuId: "$lineItems.linkedSkuId", varianceId: "$lineItems.varianceId", linkedSkus: "$lineItems.linkedSkus", productId: "$lineItems.productId", variationId: "$lineItems.variationId", lotNumber: "$lineItems.lotNumber", cost: "$lineItems.cost", total: "$lineItems.total", qty: "$lineItems.qty",
                        quantity: {
                            $cond: [
                                { $and: [{ $ne: ["$lineItems.quantity", null] }, { $ne: ["$lineItems.quantity", 0] }] },
                                "$lineItems.quantity",
                                { $ifNull: ["$lineItems.qty", 0] }
                            ]
                        }
                    }]
                }}
            ]));
        });

        // Chain ingredients off rawManufacturingJobsPromise (skip for lotsOnly — not needed for lot derivation)
        const ingredientsPromise = lotsOnly
            ? Promise.resolve([[], []] as [any, any])
            : rawManufacturingJobsPromise.then((jobs: any) => {
                const ingredientSkuIds = new Set<string>();
                ingredientSkuIds.add(id);
                jobs.forEach((job: any) => {
                    const jobSkuId = job.sku?._id || job.sku;
                    if (jobSkuId?.toString() === id) {
                        job.lineItems?.forEach((li: any) => {
                            const liSkuId = (li.sku?._id || li.sku)?.toString();
                            if (liSkuId) ingredientSkuIds.add(liSkuId);
                        });
                    }
                });

                const needsIngredients = ingredientSkuIds.size > 1;
                const ingOids = needsIngredients ? Array.from(ingredientSkuIds).flatMap(sid => [
                    mongoose.Types.ObjectId.isValid(sid) ? new mongoose.Types.ObjectId(sid) : sid,
                    sid
                ]) : [];

                if (!needsIngredients) return [[], []] as [any, any];

                return Promise.all([
                    timePipeline('b2-openingbalance', OpeningBalance.aggregate([
                        { $match: { sku: { $in: ingOids } } },
                        { $project: { _id: 1, sku: 1, lotNumber: 1, cost: 1 } }
                    ])),
                    timePipeline('b2-purchaseorder', PurchaseOrder.aggregate([
                        { $match: { "lineItems.sku": { $in: ingOids } } },
                        { $unwind: "$lineItems" },
                        { $match: { "lineItems.sku": { $in: ingOids } } },
                        { $project: {
                            _id: 1,
                            lineItems: [{
                                sku: "$lineItems.sku",
                                lotNumber: "$lineItems.lotNumber",
                                price: "$lineItems.price",
                                cost: { $cond: [{ $and: [{ $ne: ["$lineItems.cost", null] }, { $ne: ["$lineItems.cost", 0] }] }, "$lineItems.cost", "$lineItems.price"] }
                            }]
                        }}
                    ]))
                ]);
            });

        console.time('all-queries-total');
        const [
            rawManufacturingJobs, webProducts,
            openingBalances, purchaseOrders, saleOrders, adjustments, webOrders,
            [ingObs, ingPos], additionalWebOrders
        ] = await Promise.all([
            rawManufacturingJobsPromise,
            webProductsPromise,
            openingBalancesPromise,
            purchaseOrdersPromise,
            saleOrdersPromise,
            adjustmentsPromise,
            webOrdersPromise,
            ingredientsPromise,
            Promise.resolve([]) // Satisfy the downstream Node.js `additionalWebOrders` reference cleanly
        ]);
        console.timeEnd('all-queries-total');

        const manufacturingJobs = rawManufacturingJobs as any[];

        console.time('nodejs-processing');
        // Build multiplier map
        const multiplierMap = new Map<string, number>();
        (webProducts as any[]).forEach((wp: any) => {
            multiplierMap.set(`${wp.website}-${wp.webId}`, wp.multiplier || 1);
            if (wp.variations && wp.variations.length > 0) {
                wp.variations.forEach((v: any) => {
                    const vid = v.id || v._id;
                    multiplierMap.set(`${wp.website}-${wp.webId}-${vid}`, v.multiplier || wp.multiplier || 1);
                });
            }
        });

        // Initialize transaction list and definitive lot cost map
        let transactions: any[] = [];
        const lotCosts = new Map<string, number>();

        // --- PASS 1: ESTABLISH DEFINITIVE LOT COSTS (SOURCES) ---

        // 1. Opening Balances
        openingBalances.forEach((ob: any) => {
            if (ob.lotNumber && ob.cost) {
                // If multiple sources, Opening Balance is highest priority
                if (!lotCosts.has(ob.lotNumber)) lotCosts.set(ob.lotNumber, ob.cost);
            }
        });

        // 2. Purchase Orders
        purchaseOrders.forEach((po: any) => {
            po.lineItems?.forEach((line: any) => {
                const lineSkuId = line.sku?._id || line.sku;
                if (lineSkuId?.toString() === id && line.qtyReceived > 0 && line.lotNumber) {
                    const cost = line.cost || line.price || 0;
                    if (!lotCosts.has(line.lotNumber)) lotCosts.set(line.lotNumber, cost);
                }
            });
        });

        // Helper for manufacturing ingredient costs (Pass 0 results)
        const getIngredientCost = (skuId: string, lot: string) => {
            const ob = (ingObs as any[]).find((o: any) => o.sku.toString() === skuId && o.lotNumber === lot);
            if (ob) return ob.cost || 0;
            for (const po of (ingPos as any[])) {
                const line = po.lineItems?.find((l: any) => (l.sku?._id || l.sku)?.toString() === skuId && l.lotNumber === lot) || (Array.isArray(po.lineItems) ? undefined : (po.lineItems?.sku?.toString() === skuId && po.lineItems?.lotNumber === lot ? po.lineItems : undefined));
                if (line) return line.cost || line.price || 0;
            }
            return 0;
        };

        const durationToHours = (duration: string) => {
            if (!duration) return 0;
            const parts = duration.split(':').map(p => parseFloat(p) || 0);
            if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
            if (parts.length === 2) return parts[0] + parts[1] / 60;
            return parts[0] || 0;
        };

        // 3. Manufacturing (Produced)
        manufacturingJobs.forEach((job: any) => {
            const jobSkuId = job.sku?._id || job.sku;
            if (jobSkuId?.toString() === id) {
                let costPerUnit = 0;

                // Use stored totalCost if available (more accurate as it includes all cost components)
                if (job.totalCost && job.totalCost > 0) {
                    const totalQtyProduced = (job.qty || 0) + (job.qtyDifference || 0);
                    costPerUnit = totalQtyProduced > 0 ? job.totalCost / totalQtyProduced : 0;
                } else {
                    // Fallback: Calculate from raw components (materials + labor + packaging)
                    let totalMatCost = 0;
                    job.lineItems?.forEach((li: any) => {
                        const liSkuId = (li.sku?._id || li.sku)?.toString();
                        if (!liSkuId) return;
                        const totalConsumed = ((li.recipeQty || 0) * (job.qty || 0)) + (li.qtyExtra || 0) + (li.qtyScrapped || 0);
                        totalMatCost += totalConsumed * getIngredientCost(liSkuId, li.lotNumber);
                    });

                    let totalLaborCost = 0;
                    job.labor?.forEach((l: any) => { totalLaborCost += durationToHours(l.duration) * (l.hourlyRate || 0); });

                    const packagingCost = job.packagingCost || 0;
                    const totalQtyProduced = (job.qty || 0) + (job.qtyDifference || 0);
                    costPerUnit = totalQtyProduced > 0 ? (totalMatCost + totalLaborCost + packagingCost) / totalQtyProduced : 0;
                }

                const lot = job.lotNumber || job.label;
                if (lot && !lotCosts.has(lot)) {
                    lotCosts.set(lot, costPerUnit);
                }
            }
        });

        // 4. Audit Adjustments (as source if not set)
        adjustments.forEach((adj: any) => {
            if (adj.lotNumber && adj.cost && !lotCosts.has(adj.lotNumber)) {
                lotCosts.set(adj.lotNumber, adj.cost);
            }
        });

        // --- PASS 2: CONSTRUCT TRANSACTIONS USING DEFINITIVE COSTS ---

        // Opening Balances
        openingBalances.forEach((ob: any) => {
            transactions.push({
                _id: ob._id,
                date: new Date(ob.createdAt),
                type: 'Opening',
                reference: ob._id.toString(),
                lotNumber: cleanLot(ob.lotNumber) || '',
                quantity: round8(ob.qty || 0),
                uom: ob.uom,
                cost: round8(lotCosts.get(ob.lotNumber) || ob.cost || 0),
                docId: ob._id,
                link: `/warehouse/opening-balances/${ob._id}`,
                status: 'Completed'
            });
        });

        // Purchase Orders
        purchaseOrders.forEach((po: any) => {
            po.lineItems?.forEach((line: any) => {
                const lineSkuId = line.sku?._id || line.sku;
                if (lineSkuId?.toString() === id && line.qtyReceived > 0) {
                    transactions.push({
                        _id: line._id,
                        date: po.receivedDate ? new Date(po.receivedDate) : new Date(po.createdAt),
                        type: 'Purchase Order',
                        reference: po.label || po._id,
                        lotNumber: cleanLot(line.lotNumber),
                        quantity: round8(line.qtyReceived),
                        uom: line.uom,
                        cost: round8(lotCosts.get(line.lotNumber) || line.cost || line.price || 0),
                        docId: po._id,
                        link: `/warehouse/purchase-orders/${po._id}?highlightSku=${id}`,
                        status: po.status || ''
                    });
                }
            });
        });

        // Manufacturing
        manufacturingJobs.forEach((job: any) => {
            const jobSkuId = job.sku?._id || job.sku;
            // Production Record - use actual manufactured qty (qty + qtyDifference)
            if (jobSkuId?.toString() === id) {
                const lot = job.lotNumber || job.label || '';
                const actualQtyManufactured = (job.qty || 0) + (job.qtyDifference || 0);
                transactions.push({
                    _id: job._id + '_prod',
                    date: job.scheduledFinish ? new Date(job.scheduledFinish) : new Date(job.createdAt),
                    type: 'Produced',
                    reference: job.label || job._id,
                    lotNumber: cleanLot(lot),
                    quantity: round8(actualQtyManufactured),
                    uom: job.uom,
                    cost: round8(lotCosts.get(lot) || 0),
                    docId: job._id,
                    link: `/warehouse/manufacturing/${job._id}?highlightSku=${id}`,
                    status: job.status || ''
                });
            }

            // Consumption Record (Ingredients)
            job.lineItems?.forEach((line: any) => {
                const lineSkuId = line.sku?._id || line.sku;
                if (lineSkuId?.toString() === id) {
                    // Calculate totalQty using the virtual field formulas
                    const orderQty = job.qty || 0;
                    const recipeQty = line.recipeQty || 0;
                    const bomQty = orderQty * recipeQty;
                    const saPercent = line.sa || 0;
                    const sa = saPercent / 100; // Convert from percentage to decimal
                    const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                    const qtyScrapped = line.qtyScrapped || 0;
                    const totalQty = bomQty + qtyScrapped + qtyExtra;

                    if (totalQty > 0) {
                        transactions.push({
                            _id: line._id,
                            date: line.createdAt ? new Date(line.createdAt) : (job.scheduledStart ? new Date(job.scheduledStart) : new Date(job.createdAt)),
                            type: 'Consumption',
                            reference: job.label || job._id,
                            lotNumber: cleanLot(line.lotNumber),
                            quantity: round8(-totalQty),
                            uom: line.uom,
                            cost: round8(lotCosts.get(line.lotNumber) || line.cost || 0),
                            docId: job._id,
                            link: `/warehouse/manufacturing/${job._id}?highlightSku=${id}`,
                            status: job.status || ''
                        });
                    }
                }
            });
        });

        // Sale Orders (Wholesale)
        saleOrders.forEach((so: any) => {
            so.lineItems?.forEach((line: any) => {
                const lineSkuId = line.sku?._id || line.sku;
                if (lineSkuId?.toString() === id && (line.qtyShipped > 0 || line.qty > 0)) {
                    const lot = line.lotNumber || '';
                    const virtualCost = lotCosts.get(lot);
                    transactions.push({
                        _id: line._id,
                        date: so.shippedDate ? new Date(so.shippedDate) : new Date(so.createdAt),
                        type: 'Orders',
                        reference: so.label || so._id,
                        lotNumber: cleanLot(lot),
                        quantity: round8(-Math.abs(line.qtyShipped || line.qty)),
                        uom: line.uom,
                        cost: round8(virtualCost !== undefined ? virtualCost : (line.cost || 0)),
                        salePrice: round8(line.price || 0),
                        docId: so._id,
                        link: `/sales/wholesale-orders/${so._id}?highlightSku=${id}`,
                        status: so.orderStatus || ''
                    });
                }
            });
        });

        // Audit Adjustments
        adjustments.forEach((adj: any) => {
            transactions.push({
                _id: adj._id,
                date: new Date(adj.createdAt),
                type: 'Audit',
                reference: adj.reference || '',
                lotNumber: cleanLot(adj.lotNumber) || '',
                quantity: round8(adj.qty),
                uom: sku.uom || 'Unit',
                cost: round8(lotCosts.get(adj.lotNumber) || adj.cost || 0),
                docId: adj._id,
                link: `/warehouse/audit-adjustments?id=${adj._id}`,
                status: adj.status || 'Completed'
            });
        });

        // Web Orders
        // Phase 1: Process web orders already matched by direct query filters
        // Phase 2: Also resolve multi-SKU links through WebProducts (since linkedSkus
        //          may NOT be persisted on the WebOrder doc — only on the WebProduct)
        const processedWebOrderLineItems = new Set<string>(); // track to avoid duplicates

        // Build a lookup: for each WebProduct that links to this SKU, what multiplier should we use?
        // This catches products where linkedSkuId is a different SKU but linkedSkus[] contains our SKU
        const wpMultiplierForSku = new Map<string, Map<number | string, number>>(); // wpKey -> variationId|'simple' -> multiplier
        (webProducts as any[]).forEach((wp: any) => {
            const wpKey = `${wp.website}-${wp.webId}`;
            // Check product-level linkedSkus
            if (wp.linkedSkus?.length > 0) {
                const match = wp.linkedSkus.find((ls: any) => ls.skuId === id);
                if (match) {
                    if (!wpMultiplierForSku.has(wpKey)) wpMultiplierForSku.set(wpKey, new Map());
                    wpMultiplierForSku.get(wpKey)!.set('simple', match.multiplier || 1);
                }
            }
            // Check variation-level linkedSkus
            wp.variations?.forEach((v: any) => {
                const vid = v.id || v._id;
                const varLinkedSkus = v.linkedSkus?.length > 0 ? v.linkedSkus : (v.linkedSkuId ? [{ skuId: v.linkedSkuId, multiplier: v.multiplier || 1 }] : []);
                const match = varLinkedSkus.find((ls: any) => ls.skuId === id);
                if (match) {
                    if (!wpMultiplierForSku.has(wpKey)) wpMultiplierForSku.set(wpKey, new Map());
                    wpMultiplierForSku.get(wpKey)!.set(vid, match.multiplier || 1);
                }
            });
        });

        // Merge all web orders (deduplicated by _id) — additionalWebOrders already fetched in parallel above
        const allWebOrderMap = new Map<string, any>();
        (webOrders as any[]).forEach(wo => allWebOrderMap.set(wo._id.toString(), wo));
        (additionalWebOrders as any[]).forEach(wo => allWebOrderMap.set(wo._id.toString(), wo));
        const allWebOrders = Array.from(allWebOrderMap.values());

        allWebOrders.forEach((wo: any) => {
            wo.lineItems?.forEach((line: any) => {
                const lineSkuId = (line.sku?._id || line.sku)?.toString();
                // Check if this line item references the current SKU directly
                const isDirectMatch = lineSkuId === id || line.linkedSkuId === id;
                const isVarianceMatch = line.varianceId && varianceIds.includes(line.varianceId);
                // Check persisted multi-SKU linkedSkus array
                const linkedSkuMatch = line.linkedSkus?.find((ls: any) => ls.skuId === id);

                // Check via WebProduct resolution (covers un-persisted linkedSkus)
                const wpKey = `${wo.website}-${line.productId}`;
                const wpMap = wpMultiplierForSku.get(wpKey);
                let wpResolvedMultiplier: number | null = null;
                if (wpMap) {
                    // Try variation-level first, then product-level
                    if (line.variationId && wpMap.has(line.variationId)) {
                        wpResolvedMultiplier = wpMap.get(line.variationId)!;
                    } else if (wpMap.has('simple')) {
                        wpResolvedMultiplier = wpMap.get('simple')!;
                    }
                }

                if (isDirectMatch || isVarianceMatch || linkedSkuMatch || wpResolvedMultiplier !== null) {
                    // Deduplicate: skip if we already processed this exact line item for this SKU
                    const dedupeKey = `${wo._id}_${line.id || line._id}_${id}`;
                    if (processedWebOrderLineItems.has(dedupeKey)) return;
                    processedWebOrderLineItems.add(dedupeKey);

                    // Determine lot: priority order is linkedSkuMatch > isDirectMatch > wpResolved
                    // isDirectMatch MUST come before wpResolvedMultiplier — a line can be both
                    // WP-resolved AND have linkedSkuId set (direct). In that case, line.lotNumber
                    // is the authoritative lot (it was assigned via the direct SKU link).
                    const lot = linkedSkuMatch
                        ? (linkedSkuMatch.lotNumber || '')
                        : isDirectMatch
                            ? (line.lotNumber || '')
                            : (wpResolvedMultiplier !== null ? '' : ''); // WP-resolved only: no lot yet
                    const virtualCost = lotCosts.get(lot);

                    const key = line.variationId ? `${wo.website}-${line.productId}-${line.variationId}` : `${wo.website}-${line.productId}`;
                    // Priority: linkedSkuMatch multiplier > wpResolved multiplier > multiplierMap > 1
                    const multiplier = linkedSkuMatch ? (linkedSkuMatch.multiplier || 1)
                        : (wpResolvedMultiplier !== null ? wpResolvedMultiplier : (multiplierMap.get(key) || 1));
                    const qtyToDeduct = round8(-Math.abs((line.quantity || 0) * multiplier));

                    transactions.push({
                        _id: `${wo._id}_${line.id || line._id}_${id}`,
                        date: wo.dateCompleted ? new Date(wo.dateCompleted) : new Date(wo.createdAt),
                        type: 'Web Order',
                        reference: line.varianceId ? `${wo._id} (${line.varianceId})` : wo._id,
                        lotNumber: cleanLot(lot) || '',
                        quantity: qtyToDeduct,
                        uom: 'Unit',
                        cost: round8(virtualCost !== undefined ? virtualCost : (linkedSkuMatch?.cost || (isDirectMatch ? (line.cost || 0) : 0))),
                        salePrice: round8((line.total && line.quantity) ? (line.total / line.quantity) : 0),
                        docId: wo._id,
                        link: `/sales/web-orders/${wo._id}?highlightSku=${id}`,
                        varianceId: line.varianceId,
                        website: wo.website,
                        status: wo.status || ''
                    });
                }
            });
        });

        // Final sorting and calculations (Optimized)
        // When dates are equal, source (positive) records come first.
        // This prevents impossible negative-from-zero running balances.
        const typePriority: Record<string, number> = {
            'Opening': 0,
            'Audit': 1,
            'Purchase Order': 2,
            'Produced': 3,
            'Consumption': 4,
            'Orders': 5,
            'Web Order': 6,
        };
        transactions.sort((a, b) => {
            // Compare by DATE only (truncate to midnight) — same calendar day = same priority band
            const dayA = new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate()).getTime();
            const dayB = new Date(b.date.getFullYear(), b.date.getMonth(), b.date.getDate()).getTime();
            if (dayA !== dayB) return dayA - dayB;
            // Same day: positive (source) records come before negative (consumption) records
            const aPositive = a.quantity > 0 ? 0 : 1;
            const bPositive = b.quantity > 0 ? 0 : 1;
            if (aPositive !== bPositive) return aPositive - bPositive;
            // Then by type priority
            const pa = typePriority[a.type] ?? 9;
            const pb = typePriority[b.type] ?? 9;
            if (pa !== pb) return pa - pb;
            // Finally by exact timestamp for stable ordering
            return a.date.getTime() - b.date.getTime();
        });

        let balance = 0;
        let totalRevenue = 0;
        let costOfSales = 0;
        const monthlyStats = new Map<string, { revenue: number, qty: number, productionQty: number, productionCost: number }>();
        const curM = new Date(); curM.setDate(1);
        for (let i = 0; i < 12; i++) {
            const d = new Date(curM.getFullYear(), curM.getMonth() - i, 1);
            monthlyStats.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, { revenue: 0, qty: 0, productionQty: 0, productionCost: 0 });
        }

        const isPendingProduction = (t: any) => t.type === 'Produced' && ['pending', 'processing'].includes((t.status || '').toLowerCase());
        const isUnfulfilledConsumption = (t: any) => t.type === 'Consumption' && (t.status || '').toLowerCase() !== 'fulfilled' && (t.status || '').toLowerCase() !== 'trash';
        const isPendingOrder = (t: any) => t.type === 'Orders' && !['completed', 'shipped', 'pending payment'].includes((t.status || '').toLowerCase());
        const isTrashedMfg = (t: any) => (t.type === 'Produced' || t.type === 'Consumption') && (t.status || '').toLowerCase() === 'trash';
        const isPendingWebOrder = (t: any) => t.type === 'Web Order' && !['completed', 'processing'].includes((t.status || '').toLowerCase());

        const filteredTransactions = (startDate ? transactions.filter(t => t.date >= startDate) : transactions).map(t => {
            // Produced + Pending OR Consumption + not Fulfilled OR Orders + not Completed/Shipped OR Trashed MFG OR Web Order + not Completed: show in table but don't count towards balance or stats
            if (!isPendingProduction(t) && !isUnfulfilledConsumption(t) && !isPendingOrder(t) && !isTrashedMfg(t) && !isPendingWebOrder(t)) {
                balance = round8(balance + t.quantity);
            }
            const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;

            if ((t.type === 'Orders' || t.type === 'Web Order') && !isPendingOrder(t) && !isPendingWebOrder(t)) {
                const qty = Math.abs(t.quantity);
                const rev = qty * (t.salePrice || 0);
                const cos = qty * (t.cost || 0);
                totalRevenue += rev; costOfSales += cos;
                if (monthlyStats.has(key)) {
                    const s = monthlyStats.get(key)!;
                    s.revenue += rev; s.qty += qty;
                }
            } else if (t.type === 'Produced' && !isPendingProduction(t) && !isUnfulfilledConsumption(t) && !isTrashedMfg(t)) {
                if (monthlyStats.has(key)) {
                    const s = monthlyStats.get(key)!;
                    s.productionQty += t.quantity;
                    s.productionCost += t.quantity * (t.cost || 0);
                }
            }
            return { ...t, balance: round8(balance) };
        });

        const cogmTotal = transactions
            .filter(tx => tx.type === 'Produced' && !isPendingProduction(tx) && !isTrashedMfg(tx))
            .reduce((acc, tx) => acc + (Math.abs(tx.quantity) * (tx.cost || 0)), 0);

        const cogpTotal = transactions
            .filter(tx => tx.type === 'Purchase Order')
            .reduce((acc, tx) => acc + (Math.abs(tx.quantity) * (tx.cost || 0)), 0);

        const financials = {
            totalRevenue,
            costOfSales,
            grossProfit: totalRevenue - costOfSales,
            cogm: cogmTotal,
            cogp: cogpTotal,
            chartData: Array.from(monthlyStats.entries())
                .map(([date, stats]) => ({
                    date,
                    revenue: stats.revenue,
                    qty: stats.qty,
                    productionQty: stats.productionQty,
                    productionCost: stats.productionCost
                }))
                .sort((a, b) => a.date.localeCompare(b.date))
        };

        // hasSales: Only count orders where items were actually shipped/sold
        const hasSales = (saleOrders as any[]).some(so => so.lineItems?.some((li: any) => {
            const liSkuId = (li.sku?._id || li.sku)?.toString();
            // Must be this exact SKU (not a variance) AND must have actually shipped
            return liSkuId === id && (li.qtyShipped > 0);
        })) || (webOrders as any[]).some(wo => wo.lineItems?.some((li: any) => {
            const liSkuId = (li.sku?._id || li.sku)?.toString();
            // For web orders, check if it's this exact SKU (not just a variance match for raw materials)
            // and the order was completed/shipped
            return liSkuId === id && (li.quantity > 0) && (wo.status === 'Shipped' || wo.status === 'Delivered' || wo.status === 'Completed');
        }));

        const hasConsumption = manufacturingJobs.some(job => job.lineItems?.some((li: any) => {
            if ((li.sku?._id || li.sku)?.toString() !== id) return false;
            // Calculate totalQty using the virtual field formulas
            const orderQty = job.qty || 0;
            const recipeQty = li.recipeQty || 0;
            const bomQty = orderQty * recipeQty;
            const saPercent = li.sa || 0;
            const sa = saPercent / 100; // Convert from percentage to decimal
            const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
            const qtyScrapped = li.qtyScrapped || 0;
            const totalQty = bomQty + qtyScrapped + qtyExtra;
            return totalQty > 0;
        }));

        let tier = 0;
        if (hasSales && !hasConsumption) tier = 1;
        else if (hasSales && hasConsumption) tier = 2;
        else if (!hasSales && hasConsumption) tier = 3;

        console.timeEnd('nodejs-processing');

        const responseData = {
            sku: { ...sku, tier },
            transactions: filteredTransactions.reverse(),
            financials,
            totalCount: filteredTransactions.length,
            debugStartDate: startDate,
            settings: { missingSkuImage: settings?.value || '' }
        };

        // ⚡ Cache the response
        ledgerCache.set(id, { data: responseData, timestamp: Date.now() });

        console.timeEnd('ledger-route');
        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error("Error fetching SKU ledger:", error);
        console.timeEnd('ledger-route');
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
