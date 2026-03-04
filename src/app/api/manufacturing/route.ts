import { NextResponse, after } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import mongoose from 'mongoose';
import Sku from '@/models/Sku';
import User from '@/models/User';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import AuditAdjustment from '@/models/AuditAdjustment';
import { applyDateFilter } from '@/lib/global-settings';
import { getSkuTiers } from '@/lib/sku-tiers';
import { syncManufacturingToAppSheet, syncManufacturingLineItemsToAppSheet } from '@/lib/appsheet';
import { buildFuzzySearchQuery, buildFuzzyRegex } from '@/lib/fuzzy-search';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseDuration = (d: string): number => {
    if (!d) return 0;
    const p = d.split(':').map(v => parseFloat(v) || 0);
    return p.length === 3 ? p[0] + p[1] / 60 + p[2] / 3600 :
        p.length === 2 ? p[0] + p[1] / 60 : 0;
};

// Ensure indexes exist (runs once in background, idempotent)
let indexesEnsured = false;
async function ensureIndexes() {
    if (indexesEnsured) return;
    indexesEnsured = true;
    try {
        const db = mongoose.connection.db;
        if (!db) return;
        await Promise.all([
            db.collection('manufacturings').createIndex({ createdAt: -1 }, { background: true }),
            db.collection('manufacturings').createIndex({ sku: 1 }, { background: true }),
            db.collection('manufacturings').createIndex({ label: 1 }, { background: true }),
            db.collection('openingbalances').createIndex({ sku: 1, lotNumber: 1 }, { background: true }),
            db.collection('purchaseorders').createIndex({ 'lineItems.sku': 1, 'lineItems.lotNumber': 1 }, { background: true }),
            db.collection('auditadjustments').createIndex({ sku: 1, lotNumber: 1 }, { background: true }),
        ]);
    } catch { /* indexes may already exist */ }
}

// ─── SKU Hydration (batch) ────────────────────────────────────────────────────

async function hydrateSkus(orders: any[]) {
    const rawSkuIds = new Set<string>();
    orders.forEach((o: any) => { if (o.sku) rawSkuIds.add(String(o.sku)); });
    if (rawSkuIds.size === 0) return;

    const db = mongoose.connection.db;
    if (!db) return;

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
    } as any, { projection: { _id: 1, name: 1, legacyId: 1 } }).toArray();

    const byId = new Map<string, any>();
    const byLegacy = new Map<string, any>();
    allSkus.forEach((s: any) => {
        byId.set(String(s._id), s);
        if (s.legacyId) byLegacy.set(String(s.legacyId), s);
    });

    orders.forEach((o: any) => {
        if (!o.sku) return;
        const found = byId.get(String(o.sku)) || byLegacy.get(String(o.sku));
        if (found) o.sku = { _id: String(found._id), name: found.name };
    });
}

// ─── Background: Compute & Persist Costs ─────────────────────────────────────
// Runs via after() — computes costs for orders that have totalCost === 0
// and saves them back to MongoDB so future list queries are instant.

async function computeAndPersistCosts(orderIds: string[]) {
    if (orderIds.length === 0) return;

    try {
        await dbConnect();

        // Load the full orders with lineItems + labor
        const fullOrders = await Manufacturing.find({ _id: { $in: orderIds } })
            .select('_id sku qty lineItems labor')
            .lean();

        if (fullOrders.length === 0) return;

        // Collect all sku+lot combos
        const allCostSkuIds = new Set<string>();
        const allCostLots = new Set<string>();
        const allLiSkuIds = new Set<string>();

        fullOrders.forEach((o: any) => {
            o.lineItems?.forEach((li: any) => {
                const skuId = String(li.sku || '');
                if (skuId) { allCostSkuIds.add(skuId); allLiSkuIds.add(skuId); }
                if (li.lotNumber) allCostLots.add(li.lotNumber);
            });
        });

        const costSkuArr = Array.from(allCostSkuIds);
        const costLotArr = Array.from(allCostLots);
        const costMap = new Map<string, number>();
        const catMap = new Map<string, string>();

        if (costSkuArr.length > 0 && costLotArr.length > 0) {
            const db = mongoose.connection.db;
            const liSkuArr = Array.from(allLiSkuIds);
            const liObjIds = liSkuArr.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

            const [obs, pos, mfgs, adjs, liSkus] = await Promise.all([
                OpeningBalance.find({ sku: { $in: costSkuArr }, lotNumber: { $in: costLotArr } }).select('sku lotNumber cost').lean(),
                PurchaseOrder.find({ 'lineItems.sku': { $in: costSkuArr }, 'lineItems.lotNumber': { $in: costLotArr } }).select('lineItems.sku lineItems.lotNumber lineItems.cost lineItems.price').lean(),
                Manufacturing.find({ $or: [{ sku: { $in: costSkuArr }, lotNumber: { $in: costLotArr } }, { sku: { $in: costSkuArr }, label: { $in: costLotArr } }] }).select('sku lotNumber label totalCost qty qtyDifference').lean(),
                AuditAdjustment.find({ sku: { $in: costSkuArr }, lotNumber: { $in: costLotArr } }).select('sku lotNumber cost').lean(),
                db ? db.collection('skus').find({ $or: [{ _id: { $in: liSkuArr } }, { _id: { $in: liObjIds } }, { legacyId: { $in: liSkuArr } }] } as any, { projection: { _id: 1, category: 1, legacyId: 1 } }).toArray() : []
            ]);

            obs.forEach((ob: any) => { const k = `${ob.sku?.toString()}:${ob.lotNumber}`; if (ob.cost && !costMap.has(k)) costMap.set(k, ob.cost); });
            pos.forEach((po: any) => { po.lineItems?.forEach((l: any) => { const k = `${l.sku?._id?.toString() || l.sku?.toString()}:${l.lotNumber}`; if (!costMap.has(k) && (l.cost || l.price)) costMap.set(k, l.cost || l.price); }); });
            mfgs.forEach((j: any) => { const k = `${j.sku?._id?.toString() || j.sku?.toString()}:${j.lotNumber || j.label}`; if (!costMap.has(k) && j.totalCost) { const q = (j.qty || 0) + (j.qtyDifference || 0); if (q > 0) costMap.set(k, j.totalCost / q); } });
            adjs.forEach((a: any) => { const k = `${a.sku?.toString()}:${a.lotNumber}`; if (!costMap.has(k) && a.cost) costMap.set(k, a.cost); });
            liSkus.forEach((s: any) => { catMap.set(String(s._id), s.category || ''); if (s.legacyId) catMap.set(String(s.legacyId), s.category || ''); });
        }

        // Compute and save for each order
        const bulkOps: any[] = [];
        fullOrders.forEach((o: any) => {
            let materialCost = 0, packagingCost = 0, laborCost = 0;

            if (o.lineItems && Array.isArray(o.lineItems)) {
                for (const li of o.lineItems) {
                    const bomQty = (li.recipeQty || 0) * (o.qty || 0);
                    const sa = li.sa ? li.sa / 100 : 0;
                    const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                    const totalQty = bomQty + qtyExtra + (li.qtyScrapped || 0);
                    const liSkuId = String(li.sku || '');
                    const unitCost = costMap.get(`${liSkuId}:${li.lotNumber || ''}`) || li.cost || 0;
                    const lineCost = totalQty * unitCost;
                    if (catMap.get(liSkuId) === 'Packaging') packagingCost += lineCost;
                    else materialCost += lineCost;
                }
            }

            if (o.labor && Array.isArray(o.labor)) {
                for (const l of o.labor) laborCost += parseDuration(l.duration) * (l.hourlyRate || 0);
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: o._id },
                    update: { $set: { materialCost, packagingCost, laborCost, totalCost: materialCost + packagingCost + laborCost } }
                }
            });
        });

        if (bulkOps.length > 0) {
            await Manufacturing.bulkWrite(bulkOps, { ordered: false });
            console.log(`✅ Persisted costs for ${bulkOps.length} manufacturing orders`);
        }
    } catch (e) {
        console.error('❌ Background cost computation failed:', e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET — Blazing fast paginated list (reads stored costs, no computation)
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
    try {
        await dbConnect();
        void Sku; void User;

        const { searchParams } = new URL(request.url);

        // Ensure indexes in background
        after(() => ensureIndexes());

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const sku = searchParams.get('sku');
        const createdBy = searchParams.get('createdBy');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        let query: any = {};

        if (search) {
            const isNumericSearch = /^\d+$/.test(search.trim());

            if (isNumericSearch) {
                // Exact match on label for WO# lookups — instant, precise, no fuzzy
                query.label = search.trim();
            } else {
                // Text search: fuzzy match on label/legacyId + SKU name lookup
                const fuzzyRegex = buildFuzzyRegex(search);
                const matchingSkus = await Sku.find({
                    name: { $regex: fuzzyRegex, $options: 'i' }
                }).select('_id').lean();
                const matchingSkuIds = matchingSkus.map((s: any) => s._id);

                const fuzzyQuery = buildFuzzySearchQuery(search, ['label', 'legacyId']);
                if (fuzzyQuery) {
                    query.$and = fuzzyQuery.$and.map((cond: any) => ({
                        $or: [...cond.$or, ...(matchingSkuIds.length > 0 ? [{ sku: { $in: matchingSkuIds } }] : [])]
                    }));
                }
            }
        }

        if (sku) query.sku = { $in: sku.split(',') };
        if (createdBy) query.createdBy = { $in: createdBy.split(',') };
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        query = await applyDateFilter(query, 'createdAt');

        // ─── FAST QUERY: Only stored fields, NO lineItems/labor ──────────────
        // This makes the query 5-10x faster because MongoDB doesn't read/transfer
        // the huge lineItems[] and labor[] arrays from disk.
        const listFields = '_id label sku qty qtyDifference priority status createdBy finishedBy createdAt materialCost packagingCost laborCost totalCost';

        let orders: any[];

        if (sortBy === 'label') {
            orders = await Manufacturing.aggregate([
                { $match: query },
                { $addFields: { _numericLabel: { $toInt: { $ifNull: ['$label', '0'] } } } },
                { $sort: { _numericLabel: sortOrder as 1 | -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit + 1 },
                { $project: { _numericLabel: 0, lineItems: 0, labor: 0, notes: 0, qualityCheck: 0, __v: 0 } }
            ]);
            await Manufacturing.populate(orders, [
                { path: 'createdBy', select: 'firstName lastName' },
                { path: 'finishedBy', select: 'firstName lastName' },
            ]);
        } else {
            orders = await Manufacturing.find(query)
                .select(listFields)
                .populate('createdBy', 'firstName lastName')
                .populate('finishedBy', 'firstName lastName')
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit + 1)
                .lean();
        }

        const hasMore = orders.length > limit;
        orders = orders.slice(0, limit);

        // SKU hydration + tiers (2 fast queries)
        await hydrateSkus(orders);

        const tierSkuIds = new Set<string>();
        orders.forEach((o: any) => {
            if (o.sku && typeof o.sku === 'object') tierSkuIds.add(String(o.sku._id));
        });
        const tiers = await getSkuTiers(Array.from(tierSkuIds));
        orders.forEach((o: any) => {
            if (o.sku && typeof o.sku === 'object') o.sku.tier = tiers[o.sku._id?.toString()];
        });

        // ─── Background: compute & persist costs for orders that need it ─────
        const uncostIds = orders.filter((o: any) => !o.totalCost || o.totalCost === 0).map((o: any) => o._id);
        if (uncostIds.length > 0) {
            after(async () => {
                try {
                    await computeAndPersistCosts(uncostIds.map((id: any) => id.toString()));
                } catch (e) {
                    console.error('Background cost computation error:', e);
                }
            });
        }

        return NextResponse.json({ orders, hasMore, page });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Create manufacturing order
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();

        if (!body.label) {
            const result = await Manufacturing.aggregate([
                { $addFields: { numericLabel: { $toInt: { $ifNull: ['$label', '0'] } } } },
                { $sort: { numericLabel: -1 } },
                { $limit: 1 },
                { $project: { numericLabel: 1 } }
            ]);
            const maxLabel = result[0]?.numericLabel || 0;
            body.label = String(maxLabel + 1);
        }

        const newItem: any = await Manufacturing.create(body);

        after(async () => {
            try {
                await dbConnect();
                const populatedOrder: any = await Manufacturing.findById(newItem._id)
                    .populate('createdBy', 'firstName lastName email')
                    .populate('finishedBy', 'firstName lastName email')
                    .lean();

                if (populatedOrder) {
                    if (populatedOrder.sku) {
                        const skuDoc = await Sku.findById(populatedOrder.sku).select('name legacyId').lean();
                        if (skuDoc) (populatedOrder as any).sku = skuDoc;
                    }
                    await syncManufacturingToAppSheet(populatedOrder, 'Add');
                    if (populatedOrder.lineItems && populatedOrder.lineItems.length > 0) {
                        await syncManufacturingLineItemsToAppSheet(populatedOrder, populatedOrder.lineItems, 'Add');
                    }
                    console.log('✅ Manufacturing order + line items synced to AppSheet:', newItem._id);
                }
            } catch (syncError) {
                console.error('❌ Background AppSheet Manufacturing sync failed:', syncError);
            }
        });

        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
