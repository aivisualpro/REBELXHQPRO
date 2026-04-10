import { NextResponse, after } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import Counter from '@/models/Counter';
import mongoose from 'mongoose';
import Sku from '@/models/Sku';
import User from '@/models/User';
import { applyDateFilter } from '@/lib/global-settings';
import { getSkuTiers } from '@/lib/sku-tiers';
import { syncManufacturingToAppSheet, syncManufacturingLineItemsToAppSheet } from '@/lib/appsheet';
import { buildFuzzySearchQuery, buildFuzzyRegex } from '@/lib/fuzzy-search';

/**
 * Atomically generates the next manufacturing WO# label.
 * Seeds the counter from the highest existing numeric label on first use.
 * Uses MongoDB findOneAndUpdate $inc — race-condition-safe under concurrent requests.
 */
async function getNextManufacturingLabel(): Promise<string> {
    const existing = await Counter.findById('manufacturingLabel');
    if (!existing) {
        // Find the highest numeric label currently in the collection
        const result = await Manufacturing.aggregate([
            { $addFields: { _num: { $toInt: { $ifNull: ['$label', '0'] } } } },
            { $sort: { _num: -1 } },
            { $limit: 1 },
            { $project: { _num: 1 } }
        ]);
        const highestSeen = result[0]?._num || 0;

        // upsert so two concurrent "first calls" don't both try to insert
        await Counter.findOneAndUpdate(
            { _id: 'manufacturingLabel' },
            { $setOnInsert: { seq: highestSeen } },
            { upsert: true, new: false }
        );
    }

    const counter = await Counter.findOneAndUpdate(
        { _id: 'manufacturingLabel' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    return String(counter.seq);
}

// Ensure indexes once per cold start
let indexesEnsured = false;
async function ensureIndexes() {
    if (indexesEnsured) return;
    indexesEnsured = true;
    try {
        const db = mongoose.connection.db;
        if (!db) return;
        await Promise.all([
            db.collection('manufacturings').createIndex({ createdAt: -1 }, { background: true }),
            db.collection('manufacturings').createIndex({ label: 1 }, { background: true }),
            db.collection('manufacturings').createIndex({ sku: 1 }, { background: true }),
            db.collection('manufacturings').createIndex({ status: 1 }, { background: true }),
            db.collection('manufacturings').createIndex({ priority: 1 }, { background: true }),
        ]);
    } catch { /* already exist */ }
}

// SKU hydration (single batch query)
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

// ═══════════════════════════════════════════════════════════════════════════════
// GET — Lean paginated list. Reads stored fields only. No background thrashing.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
    try {
        await dbConnect();
        void Sku; void User;

        const { searchParams } = new URL(request.url);

        // Background: ensure indexes (once, fast)
        after(() => ensureIndexes());

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const sku = searchParams.get('sku');
        const createdBy = searchParams.get('createdBy');
        const status = searchParams.get('status');
        const priority = searchParams.get('priority');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        let query: any = {};

        // ─── Smart search ────────────────────────────────────────────────────
        if (search) {
            const trimmed = search.trim();
            const isNumeric = /^\d+$/.test(trimmed);

            if (isNumeric) {
                // WO# search: indexed prefix match on label field
                // "10922" → finds exactly WO# 10922
                // "1092"  → finds WO# 10921, 10922, 10923, etc.
                query.label = { $regex: `^${trimmed}` };
            } else {
                // Text search: fuzzy match on SKU names + label
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
        if (status) query.status = status;
        if (priority) query.priority = { $regex: priority, $options: 'i' };
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        query = await applyDateFilter(query, 'createdAt');

        // ─── LEAN QUERY: stored fields only, NO lineItems/labor ──────────────
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
        } else if (sortBy === 'unitCost') {
            // unitCost is computed as totalCost / qty — needs aggregation
            orders = await Manufacturing.aggregate([
                { $match: query },
                { $addFields: { _unitCost: { $cond: [{ $gt: ['$qty', 0] }, { $divide: [{ $ifNull: ['$totalCost', 0] }, '$qty'] }, 0] } } },
                { $sort: { _unitCost: sortOrder as 1 | -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit + 1 },
                { $project: { _unitCost: 0, lineItems: 0, labor: 0, notes: 0, qualityCheck: 0, __v: 0 } }
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

        // SKU hydration + tiers (2 fast indexed queries)
        await hydrateSkus(orders);

        const tierSkuIds = new Set<string>();
        orders.forEach((o: any) => {
            if (o.sku && typeof o.sku === 'object') tierSkuIds.add(String(o.sku._id));
        });
        if (tierSkuIds.size > 0) {
            const tiers = await getSkuTiers(Array.from(tierSkuIds));
            orders.forEach((o: any) => {
                if (o.sku && typeof o.sku === 'object') o.sku.tier = tiers[o.sku._id?.toString()];
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

        // Always generate the label server-side — atomic & race-condition-safe.
        body.label = await getNextManufacturingLabel();

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
                    console.log('✅ Manufacturing order synced to AppSheet:', newItem._id);
                }
            } catch (syncError) {
                console.error('❌ Background AppSheet sync failed:', syncError);
            }
        });

        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
