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
    } as any, { projection: { _id: 1, name: 1, category: 1, legacyId: 1 } }).toArray();

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

// ─── Cost Enrichment (batch, parallel, indexed) ──────────────────────────────

async function enrichOrderCosts(orders: any[]) {
    const db = mongoose.connection.db;
    if (!db) return;

    // 1. Build lineItem SKU category map
    const liSkuIds = new Set<string>();
    const allCostSkuIds = new Set<string>();
    const allCostLots = new Set<string>();

    orders.forEach((o: any) => {
        o.lineItems?.forEach((li: any) => {
            const skuId = String(li.sku || '');
            if (skuId) { liSkuIds.add(skuId); allCostSkuIds.add(skuId); }
            if (li.lotNumber) allCostLots.add(li.lotNumber);
        });
    });

    if (allCostSkuIds.size === 0) {
        // No line items — just compute labor
        orders.forEach((o: any) => {
            let laborCost = 0;
            if (o.labor && Array.isArray(o.labor)) {
                for (const l of o.labor) laborCost += parseDuration(l.duration) * (l.hourlyRate || 0);
            }
            o.materialCost = 0; o.packagingCost = 0; o.laborCost = laborCost;
            o.totalCost = laborCost;
        });
        return;
    }

    const costSkuArr = Array.from(allCostSkuIds);
    const costLotArr = Array.from(allCostLots);
    const liSkuArr = Array.from(liSkuIds);
    const liObjectIds = liSkuArr.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

    // 2. Parallel: fetch cost sources + SKU categories at once
    const [openingBalances, purchaseOrders, mfgJobs, auditAdjs, liSkus] = await Promise.all([
        costLotArr.length > 0 ? OpeningBalance.find({
            sku: { $in: costSkuArr }, lotNumber: { $in: costLotArr }
        }).select('sku lotNumber cost').lean() : [],

        costLotArr.length > 0 ? PurchaseOrder.find({
            'lineItems.sku': { $in: costSkuArr }, 'lineItems.lotNumber': { $in: costLotArr }
        }).select('lineItems.sku lineItems.lotNumber lineItems.cost lineItems.price').lean() : [],

        costLotArr.length > 0 ? Manufacturing.find({
            $or: [
                { sku: { $in: costSkuArr }, lotNumber: { $in: costLotArr } },
                { sku: { $in: costSkuArr }, label: { $in: costLotArr } }
            ]
        }).select('sku lotNumber label totalCost qty qtyDifference').lean() : [],

        costLotArr.length > 0 ? AuditAdjustment.find({
            sku: { $in: costSkuArr }, lotNumber: { $in: costLotArr }
        }).select('sku lotNumber cost').lean() : [],

        db.collection('skus').find({
            $or: [
                { _id: { $in: liSkuArr } },
                { _id: { $in: liObjectIds } },
                { legacyId: { $in: liSkuArr } }
            ]
        } as any, { projection: { _id: 1, category: 1, legacyId: 1 } }).toArray()
    ]);

    // 3. Build cost map
    const costMap = new Map<string, number>();

    openingBalances.forEach((ob: any) => {
        const key = `${ob.sku?.toString()}:${ob.lotNumber}`;
        if (ob.cost && !costMap.has(key)) costMap.set(key, ob.cost);
    });

    purchaseOrders.forEach((po: any) => {
        po.lineItems?.forEach((line: any) => {
            const skuId = line.sku?._id?.toString() || line.sku?.toString();
            const key = `${skuId}:${line.lotNumber}`;
            if (!costMap.has(key) && (line.cost || line.price)) costMap.set(key, line.cost || line.price);
        });
    });

    mfgJobs.forEach((job: any) => {
        const skuId = job.sku?._id?.toString() || job.sku?.toString();
        const lot = job.lotNumber || job.label;
        const key = `${skuId}:${lot}`;
        if (!costMap.has(key) && job.totalCost) {
            const qtyP = (job.qty || 0) + (job.qtyDifference || 0);
            if (qtyP > 0) costMap.set(key, job.totalCost / qtyP);
        }
    });

    auditAdjs.forEach((adj: any) => {
        const key = `${adj.sku?.toString()}:${adj.lotNumber}`;
        if (!costMap.has(key) && adj.cost) costMap.set(key, adj.cost);
    });

    // 4. Build category map
    const catMap = new Map<string, string>();
    liSkus.forEach((s: any) => {
        catMap.set(String(s._id), s.category || '');
        if (s.legacyId) catMap.set(String(s.legacyId), s.category || '');
    });

    // 5. Compute costs per order
    orders.forEach((o: any) => {
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

        o.materialCost = materialCost;
        o.packagingCost = packagingCost;
        o.laborCost = laborCost;
        o.totalCost = materialCost + packagingCost + laborCost;
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET — Fast paginated list with costs
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
    try {
        await dbConnect();
        void Sku; void User; void OpeningBalance; void PurchaseOrder; void AuditAdjustment;

        const { searchParams } = new URL(request.url);

        // Ensure indexes in background (runs once per cold start)
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

        // Search: find matching SKU IDs then OR with label/legacyId
        let matchingSkuIds: string[] = [];
        if (search) {
            const fuzzyRegex = buildFuzzyRegex(search);
            const matchingSkus = await Sku.find({
                name: { $regex: fuzzyRegex, $options: 'i' }
            }).select('_id').lean();
            matchingSkuIds = matchingSkus.map((s: any) => s._id);

            const fuzzyQuery = buildFuzzySearchQuery(search, ['label', 'legacyId']);
            if (fuzzyQuery) {
                query.$and = fuzzyQuery.$and.map((cond: any) => ({
                    $or: [
                        ...cond.$or,
                        ...(matchingSkuIds.length > 0 ? [{ sku: { $in: matchingSkuIds } }] : [])
                    ]
                }));
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

        // ─── Fast query: limit+1 trick (no count query needed) ───────────────
        let orders: any[];

        if (sortBy === 'label') {
            orders = await Manufacturing.aggregate([
                { $match: query },
                { $addFields: { _numericLabel: { $toInt: { $ifNull: ['$label', '0'] } } } },
                { $sort: { _numericLabel: sortOrder as 1 | -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit + 1 },
                { $project: { _numericLabel: 0, notes: 0, qualityCheck: 0, __v: 0 } }
            ]);
            await Manufacturing.populate(orders, [
                { path: 'createdBy', select: 'firstName lastName' },
                { path: 'finishedBy', select: 'firstName lastName' },
            ]);
        } else {
            orders = await Manufacturing.find(query)
                .select('-notes -qualityCheck -__v')
                .populate('createdBy', 'firstName lastName')
                .populate('finishedBy', 'firstName lastName')
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit + 1)
                .lean();
        }

        // hasMore = got more than limit results
        const hasMore = orders.length > limit;
        orders = orders.slice(0, limit);

        // ─── Parallel enrichment: SKU hydration + costs + tiers ──────────────
        await Promise.all([
            hydrateSkus(orders),
            enrichOrderCosts(orders),
        ]);

        // Tiers (needs hydrated SKU IDs)
        const tierSkuIds = new Set<string>();
        orders.forEach((o: any) => {
            if (o.sku && typeof o.sku === 'object') tierSkuIds.add(String(o.sku._id));
        });
        const tiers = await getSkuTiers(Array.from(tierSkuIds));
        orders.forEach((o: any) => {
            if (o.sku && typeof o.sku === 'object') o.sku.tier = tiers[o.sku._id?.toString()];
        });

        // Strip heavy arrays from response
        orders.forEach((o: any) => {
            delete o.lineItems; delete o.labor; delete o.recipesId;
        });

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
