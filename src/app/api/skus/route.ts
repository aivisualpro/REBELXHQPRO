import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';
import { applyDateFilter } from '@/lib/global-settings';

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

        let query: any = {};
        
        // Apply Global Date Filter (unless ignored for dropdowns)
        const ignoreDate = searchParams.get('ignoreDate') === 'true';
        if (!ignoreDate) {
            query = await applyDateFilter(query, 'createdAt');
        }

        const escapeRegex = (string: string) => {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        if (search) {
            const escapedSearch = escapeRegex(search);
            query.$or = [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { _id: { $regex: escapedSearch, $options: 'i' } } // Search by SKU (which is _id)
            ];
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

        const queryObj = Sku.find(query).sort({ [sortBy]: sortOrder as any });

        if (limit > 0) {
            queryObj.skip((page - 1) * limit).limit(limit);
        }

        const [total, skusRaw] = await Promise.all([
            Sku.countDocuments(query),
            queryObj.lean()
        ]);

        const skuIds = skusRaw.map(s => s._id);
        const allVarianceIds = skusRaw.flatMap(s => (s as any).variances?.map((v: any) => v._id) || []);

        // 1. Bulk Fetch all related data for ALL SKUs on the page
        const [obsAll, posAll, mosCompletedAll, sosAll, mosIngredientsAll, adjsAll, wosAll] = await Promise.all([
            OpeningBalance.find({ sku: { $in: skuIds } }).lean(),
            PurchaseOrder.find({ 'lineItems.sku': { $in: skuIds }, status: 'Received' }).lean(),
            Manufacturing.find({ sku: { $in: skuIds }, status: 'Completed' }).populate('lineItems.sku labor').lean(),
            SaleOrder.find({ 'lineItems.sku': { $in: skuIds }, orderStatus: { $in: ['Shipped', 'Completed'] } }).lean(),
            Manufacturing.find({ 'lineItems.sku': { $in: skuIds }, status: { $in: ['In Progress', 'Completed'] } }).lean(),
            AuditAdjustment.find({ sku: { $in: skuIds } }).lean(),
            WebOrder.find({
                $or: [
                    { "lineItems.sku": { $in: skuIds } },
                    { "lineItems.varianceId": { $in: allVarianceIds } }
                ],
                status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'] }
            }).lean()
        ]);

        // 2. Pre-fetch Ingredient costs for COGM calculations
        const ingredientKeys: Set<string> = new Set();
        mosCompletedAll.forEach((mo: any) => {
            mo.lineItems?.forEach((li: any) => {
                const liSkuId = (li.sku?._id || li.sku);
                if (liSkuId && li.lotNumber) ingredientKeys.add(`${liSkuId}:${li.lotNumber}`);
            });
        });

        const [ingObs, ingPos] = await Promise.all([
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
                }
            }).select('lineItems status').lean()
        ]);

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

        // 3. Map values for quick lookup
        const obsMap = new Map();
        obsAll.forEach(o => { if(!obsMap.has(o.sku)) obsMap.set(o.sku, []); obsMap.get(o.sku).push(o); });
        
        const posMap = new Map();
        posAll.forEach(po => {
            po.lineItems?.forEach((li: any) => {
                if(!posMap.has(li.sku)) posMap.set(li.sku, []);
                posMap.get(li.sku).push({ ...li, poId: po._id });
            });
        });

        const mosProdMap = new Map();
        mosCompletedAll.forEach(mo => { if(!mosProdMap.has(mo.sku)) mosProdMap.set(mo.sku, []); mosProdMap.get(mo.sku).push(mo); });

        const sosMap = new Map();
        sosAll.forEach(so => {
            so.lineItems?.forEach((li: any) => {
                if(!sosMap.has(li.sku)) sosMap.set(li.sku, []);
                sosMap.get(li.sku).push(li);
            });
        });

        const mosConsMap = new Map();
        mosIngredientsAll.forEach(mo => {
            mo.lineItems?.forEach((li: any) => {
                const liSkuId = li.sku?._id || li.sku;
                if(!mosConsMap.has(liSkuId)) mosConsMap.set(liSkuId, []);
                mosConsMap.get(liSkuId).push({ ...li, mo });
            });
        });

        const adjsMap = new Map();
        adjsAll.forEach(a => { if(!adjsMap.has(a.sku)) adjsMap.set(a.sku, []); adjsMap.get(a.sku).push(a); });

        const wosBySku = new Map();
        const wosByVariance = new Map();
        wosAll.forEach(wo => {
            wo.lineItems?.forEach((li: any) => {
                const liSkuId = li.sku?._id || li.sku;
                if (liSkuId) {
                    if(!wosBySku.has(liSkuId)) wosBySku.set(liSkuId, []);
                    wosBySku.get(liSkuId).push(li);
                }
                if (li.varianceId) {
                    if(!wosByVariance.has(li.varianceId)) wosByVariance.set(li.varianceId, []);
                    wosByVariance.get(li.varianceId).push(li);
                }
            });
        });

        // 4. Enrich SKUs using Local Maps
        const skus = skusRaw.map((sku: any) => {
            const id = sku._id;
            const varianceIds = sku.variances?.map((v: any) => v._id) || [];

            let qtyIn = 0;
            let qtyOut = 0;
            let totalCostIn = 0;
            let revenue = 0;
            let cogs = 0;
            let cogm = 0;

            (obsMap.get(id) || []).forEach((o: any) => {
                qtyIn += (o.qty || 0);
                totalCostIn += (o.qty || 0) * (o.cost || 0);
            });

            (posMap.get(id) || []).forEach((li: any) => {
                const received = (li.qtyReceived || li.qty || 0);
                qtyIn += received;
                totalCostIn += received * (li.cost || 0);
            });

            (mosProdMap.get(id) || []).forEach((mo: any) => {
                const qty = (mo.qty || 0) + (mo.qtyDifference || 0);
                qtyIn += qty;

                let moCost = 0;
                mo.lineItems?.forEach((li: any) => {
                    const liSkuId = (li.sku?._id || li.sku);
                    const liQty = (li.recipeQty || 0) * (mo.qty || 0) + (li.qtyExtra || 0) + (li.qtyScrapped || 0);
                    const unitCost = li.cost || getLotCostBulk(liSkuId?.toString(), li.lotNumber);
                    moCost += liQty * unitCost;
                });
                mo.labor?.forEach((lab: any) => {
                    const parts = (lab.duration || '0:0:0').split(':');
                    const hours = parseInt(parts[0] || '0') + parseInt(parts[1] || '0')/60 + parseInt(parts[2] || '0')/3600;
                    moCost += hours * (lab.hourlyRate || 0);
                });
                if (qty > 0) totalCostIn += moCost;
                cogm += moCost;
            });

            (adjsMap.get(id) || []).forEach((a: any) => {
                if (a.qty > 0) {
                    qtyIn += a.qty;
                    totalCostIn += a.qty * (a.cost || 0);
                } else {
                    qtyOut += Math.abs(a.qty);
                }
            });

            (sosMap.get(id) || []).forEach((li: any) => {
                const q = li.qtyShipped || li.qty || 0;
                qtyOut += q;
                revenue += q * (li.price || 0);
                cogs += q * (li.cost || 0);
            });

            const webLines = [...(wosBySku.get(id) || [])];
            varianceIds.forEach((vid: string) => {
                webLines.push(...(wosByVariance.get(vid) || []));
            });
            webLines.forEach((li: any) => {
                const q = li.qty || 0;
                qtyOut += q;
                revenue += (li.total || 0);
            });

            (mosConsMap.get(id) || []).forEach((li: any) => {
                const bomQty = (li.recipeQty || 0) * (li.mo.qty || 0);
                qtyOut += (bomQty + (li.qtyExtra || 0) + (li.qtyScrapped || 0));
            });

            return {
                ...sku,
                currentStock: qtyIn - qtyOut,
                avgCost: qtyIn > 0 ? totalCostIn / qtyIn : 0,
                revenue,
                cogs,
                cogm,
                grossProfit: revenue - cogs
            };
        });

        return NextResponse.json({
            skus,
            total,
            page,
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

        // _id will be auto-generated if not provided, or mapped from sku if present
        const skuData = { ...body };
        if (body.sku) skuData._id = body.sku;
        const newSku = await Sku.create(skuData);
        return NextResponse.json(newSku);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
