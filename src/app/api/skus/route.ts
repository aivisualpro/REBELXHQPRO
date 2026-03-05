import { NextResponse, after } from 'next/server';
import { buildFuzzySearchQuery } from '@/lib/fuzzy-search';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';
import { applyDateFilter } from '@/lib/global-settings';
import { getSkuTiers } from '@/lib/sku-tiers';
import { syncSkuToAppSheet } from '@/lib/appsheet';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limitParam = searchParams.get('limit');
        const limit = limitParam === '0' ? 0 : parseInt(limitParam || '20');
        const sortBy = searchParams.get('sortBy') || 'name';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const category = searchParams.get('category');
        const subCategory = searchParams.get('subCategory');
        const materialType = searchParams.get('materialType');
        const isWebProduct = searchParams.get('isWebProduct');

        let query: any = {};

        // Apply Global Date Filter (unless ignored for dropdowns)
        const ignoreDate = searchParams.get('ignoreDate') === 'true';
        if (!ignoreDate) {
            query = await applyDateFilter(query, 'createdAt');
        }

        if (search) {
            const fuzzyQuery = buildFuzzySearchQuery(search, ['name', '_id']);
            if (fuzzyQuery) Object.assign(query, fuzzyQuery);
        }

        if (category) {
            query.category = { $in: category.split(',') };
        }
        if (subCategory) {
            query.subCategory = { $in: subCategory.split(',') };
        }
        if (materialType) {
            query.materialType = { $in: materialType.split(',') };
        }
        if (isWebProduct === 'true') {
            query.isWebProduct = true;
        }

        const simpleMode = searchParams.get('simple') === 'true';

        console.log('SKU API Sort:', { sortBy, sortOrder, simpleMode });
        const queryObj = Sku.find(query).sort({ [sortBy]: sortOrder as any });

        if (limit > 0) {
            queryObj.skip((page - 1) * limit).limit(limit);
        }

        const [total, skusRaw] = await Promise.all([
            Sku.countDocuments(query),
            queryObj.lean()
        ]);

        if (simpleMode) {
            return NextResponse.json({
                skus: skusRaw,
                total,
                page,
                hasMore: page * (limit || 20) < total,
                totalPages: Math.ceil(total / (limit || 20))
            });
        }

        const skuIds = skusRaw.map(s => s._id);
        const strSkuIds = skusRaw.map(s => s._id.toString());
        const allVariances = skusRaw.flatMap(s => (s as any).variances?.map((v: any) => v._id) || []);

        // Dual-type array for collections that store sku as ObjectId or Mixed
        const { ObjectId } = require('mongodb');
        const dualSkuIds = [
            ...strSkuIds,
            ...strSkuIds.filter(id => ObjectId.isValid(id)).map((id: string) => new ObjectId(id))
        ];

        const tiers = await getSkuTiers(strSkuIds);

        // --- Optimized Aggregations ---

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
            // 1. Opening Balances (Mixed type — use dual IDs)
            OpeningBalance.aggregate([
                { $match: { sku: { $in: dualSkuIds } } },
                { $addFields: { skuStr: { $toString: "$sku" } } },
                {
                    $group: {
                        _id: "$skuStr",
                        qty: { $sum: "$qty" },
                        costVal: { $sum: { $multiply: ["$qty", "$cost"] } }
                    }
                }
            ]),
            // 2. Purchase Orders (String type — use string IDs)
            PurchaseOrder.aggregate([
                { $match: { "lineItems.sku": { $in: skuIds }, status: "Received" } },
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
            // 3. Sale Orders (ObjectId type — use dual IDs)
            SaleOrder.aggregate([
                { $match: { "lineItems.sku": { $in: dualSkuIds } } },
                { $unwind: "$lineItems" },
                { $match: { "lineItems.sku": { $in: dualSkuIds } } },
                { $match: { orderStatus: { $in: ['Shipped', 'Completed'] } } },
                { $addFields: { "lineItems.skuStr": { $toString: "$lineItems.sku" } } },
                {
                    $group: {
                        _id: "$lineItems.skuStr",
                        qty: { $sum: "$lineItems.qtyShipped" },
                        revenue: { $sum: { $multiply: ["$lineItems.qtyShipped", "$lineItems.price"] } },
                        cogs: { $sum: { $multiply: ["$lineItems.qtyShipped", "$lineItems.cost"] } }
                    }
                }
            ]),
            // 4. Manufacturing - Produced (all except Pending — matches ledger logic)
            Manufacturing.find({ sku: { $in: skuIds }, status: { $ne: 'Pending' } })
                .select('sku qty qtyDifference lineItems labor status')
                .lean(),

            // 5. Manufacturing - Consumed (ONLY Fulfilled — matches ledger logic)
            Manufacturing.find({ "lineItems.sku": { $in: skuIds }, status: 'Fulfilled' })
                .select('lineItems qty status')
                .lean(),

            // 6. Audit Adjustments (Mixed type — use dual IDs)
            AuditAdjustment.aggregate([
                { $match: { sku: { $in: dualSkuIds } } },
                { $addFields: { skuStr: { $toString: "$sku" } } },
                {
                    $group: {
                        _id: "$skuStr",
                        netQty: { $sum: "$qty" },
                        costVal: { $sum: { $multiply: ["$qty", "$cost"] } }
                    }
                }
            ]),

            // 7. Web Orders (By SKU — String type, including linkedSkuId)
            WebOrder.aggregate([
                {
                    $match: {
                        $or: [
                            { "lineItems.sku": { $in: skuIds } },
                            { "lineItems.linkedSkuId": { $in: strSkuIds } }
                        ],
                        status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'] }
                    }
                },
                { $unwind: "$lineItems" },
                {
                    $match: {
                        $or: [
                            { "lineItems.sku": { $in: skuIds } },
                            { "lineItems.linkedSkuId": { $in: strSkuIds } }
                        ]
                    }
                },
                // Normalize to a single key for grouping
                {
                    $addFields: {
                        resolvedSkuId: { $ifNull: ["$lineItems.linkedSkuId", { $ifNull: ["$lineItems.sku", null] }] }
                    }
                },
                {
                    $group: {
                        _id: "$resolvedSkuId",
                        qty: { $sum: "$lineItems.quantity" },
                        revenue: { $sum: "$lineItems.total" }
                    }
                }
            ]),

            // 8. Web Orders (By Variance)
            WebOrder.aggregate([
                {
                    $match: {
                        "lineItems.varianceId": { $in: allVariances },
                        status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'] }
                    }
                },
                { $unwind: "$lineItems" },
                { $match: { "lineItems.varianceId": { $in: allVariances } } },
                {
                    $group: {
                        _id: "$lineItems.varianceId",
                        qty: { $sum: "$lineItems.quantity" },
                        revenue: { $sum: "$lineItems.total" }
                    }
                }
            ])
        ]);

        // --- Value Mapping Helpers ---
        const obsMap = new Map();
        obsAgg.forEach((r: any) => obsMap.set(r._id, r));

        const posMap = new Map();
        posAgg.forEach((r: any) => posMap.set(r._id, r));

        const sosMap = new Map();
        sosAgg.forEach((r: any) => sosMap.set(r._id, r));

        const adjsMap = new Map();
        adjsAgg.forEach((r: any) => adjsMap.set(r._id, r));

        const wosSkuMap = new Map();
        wosSkuAgg.forEach((r: any) => wosSkuMap.set(r._id, r));

        const wosVarMap = new Map();
        wosVarAgg.forEach((r: any) => wosVarMap.set(r._id, r));

        // Manufacturing requires ingredient cost lookups. 
        const ingredientKeys: Set<string> = new Set();
        (mosProdAgg as any[]).forEach((mo: any) => {
            mo.lineItems?.forEach((li: any) => {
                const liSkuId = (li.sku?._id || li.sku);
                if (liSkuId && li.lotNumber) ingredientKeys.add(`${liSkuId}:${li.lotNumber}`);
            });
        });

        // Bulk fetch ingredient costs (only if needed)
        let ingObs: any[] = [];
        let ingPos: any[] = [];

        if (ingredientKeys.size > 0) {
            [ingObs, ingPos] = await Promise.all([
                OpeningBalance.find({
                    sku: { $in: Array.from(ingredientKeys).map(k => k.split(':')[0]) },
                    lotNumber: { $in: Array.from(ingredientKeys).map(k => k.split(':')[1]) }
                }).select('sku lotNumber cost').lean(),
                PurchaseOrder.find({
                    "lineItems": {
                        $elemMatch: {
                            sku: { $in: Array.from(ingredientKeys).map(k => k.split(':')[0]) },
                            lotNumber: { $in: Array.from(ingredientKeys).map(k => k.split(':')[1]) }
                        }
                    },
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
            return 0; // fallback
        };

        // --- Final Assembly ---
        const skus = skusRaw.map((sku: any) => {
            const id = sku._id.toString();
            const varianceIds = sku.variances?.map((v: any) => v._id) || [];

            let qtyIn = 0;
            let qtyOut = 0;
            let totalCostIn = 0;
            let revenue = 0;
            let cogs = 0;
            let cogm = 0;

            // 1. OBs
            const obData = obsMap.get(id);
            if (obData) {
                qtyIn += obData.qty || 0;
                totalCostIn += obData.costVal || 0;
            }

            // 2. POs
            const poData = posMap.get(id);
            if (poData) {
                qtyIn += poData.qty || 0;
                totalCostIn += poData.costVal || 0;
            }

            // 3. MOs (Production - In)
            // Still iterating here but only on relevant subset
            const myMos = (mosProdAgg as any[]).filter((m: any) => m.sku?.toString() === id);
            myMos.forEach((mo: any) => {
                const qty = (mo.qty || 0) + (mo.qtyDifference || 0);
                qtyIn += qty;

                let moCost = 0;
                mo.lineItems?.forEach((li: any) => {
                    const liSkuId = (li.sku?._id || li.sku);
                    const orderQty = mo.qty || 0;
                    const recipeQty = li.recipeQty || 0;
                    const bomQty = orderQty * recipeQty;
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
                cogm += moCost;
            });

            // 4. MOs (Consumption - Out)
            // Need to filter locally as we fetched by Ingredient
            const myConsMos = (mosConsAgg as any[]).filter((m: any) => {
                return m.lineItems.some((li: any) => (li.sku?._id || li.sku)?.toString() === id);
            });

            myConsMos.forEach((mo: any) => {
                // Use filter (not find) — a job may have multiple line items for the same SKU (different lots)
                const matchingLines = mo.lineItems.filter((l: any) => (l.sku?._id || l.sku)?.toString() === id);
                matchingLines.forEach((li: any) => {
                    const orderQty = mo.qty || 0;
                    const recipeQty = li.recipeQty || 0;
                    const bomQty = orderQty * recipeQty;
                    const saPercent = li.sa || 0;
                    const sa = saPercent / 100;
                    const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                    const qtyScrapped = li.qtyScrapped || 0;
                    const totalConsumed = bomQty + qtyScrapped + qtyExtra;
                    qtyOut += totalConsumed;
                });
            });

            // 5. Adjustments
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

            // 6. Sales
            const soData = sosMap.get(id);
            if (soData) {
                qtyOut += soData.qty || 0;
                revenue += soData.revenue || 0;
                cogs += soData.cogs || 0;
            }

            // 7. Web Orders
            const woSku = wosSkuMap.get(id);
            if (woSku) {
                qtyOut += woSku.qty || 0;
                revenue += woSku.revenue || 0;
            }

            varianceIds.forEach((vid: string) => {
                const woVar = wosVarMap.get(vid);
                if (woVar) {
                    qtyOut += woVar.qty || 0;
                    revenue += woVar.revenue || 0;
                }
            });

            const hasSales = (soData || woSku || wosVarMap.has(varianceIds[0])); // approximated check
            const hasConsumption = (myConsMos.length > 0);

            return {
                ...sku,
                currentStock: qtyIn - qtyOut,
                avgCost: qtyIn > 0 ? totalCostIn / qtyIn : 0,
                revenue,
                cogs,
                cogm,
                grossProfit: revenue - cogs,
                totalWebOrders: sku.totalWebOrders || 0,
                tier: tiers[id] || 0
            };
        });

        return NextResponse.json({
            skus,
            total,
            page,
            hasMore: page * limit < total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();

        const newSku = new Sku(body);
        await newSku.save();

        // Sync to AppSheet in background
        after(async () => {
            try {
                await syncSkuToAppSheet(newSku, 'Add');
                console.log('✅ New SKU synced to AppSheet:', newSku._id);
            } catch (syncError) {
                console.error('❌ Background AppSheet SKU sync failed:', syncError);
            }
        });

        return NextResponse.json(newSku);
    } catch (error: any) {
        console.error('Create SKU error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
