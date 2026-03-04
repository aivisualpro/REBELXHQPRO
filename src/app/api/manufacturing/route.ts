import { NextResponse, after } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import mongoose from 'mongoose';
import Sku from '@/models/Sku';
import User from '@/models/User';
import { applyDateFilter } from '@/lib/global-settings';
import { getSkuTiers } from '@/lib/sku-tiers';
import { syncManufacturingToAppSheet, syncManufacturingLineItemsToAppSheet } from '@/lib/appsheet';
import { buildFuzzySearchQuery, buildFuzzyRegex } from '@/lib/fuzzy-search';

export async function GET(request: Request) {
    try {
        await dbConnect();
        // Ensure models are registered for populate()
        void Sku;
        void User;

        const { searchParams } = new URL(request.url);
        const fields = searchParams.get('fields');

        // ─── FAST PATH: Lightweight list for client-side filtering ────────────
        // Returns ALL orders with computed costs. Client does search/sort/filter locally.
        if (fields === 'list') {
            let query: any = {};

            // Apply Global Date Filter only
            query = await applyDateFilter(query, 'createdAt');

            // Load orders WITH lineItems and labor for cost computation, but exclude notes/qualityCheck
            const orders = await Manufacturing.find(query)
                .select('-notes -qualityCheck -__v')
                .populate('createdBy', 'firstName lastName')
                .populate('finishedBy', 'firstName lastName')
                .sort({ createdAt: -1 })
                .lean();

            // SKU hydration (batch — single query)
            const rawSkuIds = new Set<string>();
            orders.forEach((o: any) => {
                if (o.sku) rawSkuIds.add(String(o.sku));
            });

            const db = mongoose.connection.db;
            const skuById = new Map<string, any>();
            const skuByLegacy = new Map<string, any>();

            if (db && rawSkuIds.size > 0) {
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

                allSkus.forEach((s: any) => {
                    skuById.set(String(s._id), s);
                    if (s.legacyId) skuByLegacy.set(String(s.legacyId), s);
                });
            }

            // Also build a map of lineItem SKU categories for cost classification
            const liSkuIds = new Set<string>();
            orders.forEach((o: any) => {
                o.lineItems?.forEach((li: any) => {
                    if (li.sku) liSkuIds.add(String(li.sku));
                });
            });

            const liSkuCategoryMap = new Map<string, string>();
            if (db && liSkuIds.size > 0) {
                const liSkuArr = Array.from(liSkuIds);
                const liObjectIds = liSkuArr
                    .filter(id => mongoose.Types.ObjectId.isValid(id))
                    .map(id => new mongoose.Types.ObjectId(id));

                const liSkus = await db.collection('skus').find({
                    $or: [
                        { _id: { $in: liSkuArr } },
                        { _id: { $in: liObjectIds } },
                        { legacyId: { $in: liSkuArr } }
                    ]
                } as any, { projection: { _id: 1, category: 1, legacyId: 1 } }).toArray();

                liSkus.forEach((s: any) => {
                    liSkuCategoryMap.set(String(s._id), s.category || '');
                    if (s.legacyId) liSkuCategoryMap.set(String(s.legacyId), s.category || '');
                });
            }

            // Helper to parse "HH:MM:SS" to decimal hours
            const parseDur = (d: string): number => {
                if (!d) return 0;
                const p = d.split(':').map(v => parseFloat(v) || 0);
                return p.length === 3 ? p[0] + p[1] / 60 + p[2] / 3600 :
                    p.length === 2 ? p[0] + p[1] / 60 : 0;
            };

            // Hydrate + compute costs + tiers in a single pass, then strip heavy arrays
            const tierSkuIds = new Set<string>();
            orders.forEach((o: any) => {
                // SKU hydration
                if (o.sku) {
                    const skuStr = String(o.sku);
                    const found = skuById.get(skuStr) || skuByLegacy.get(skuStr);
                    if (found) {
                        o.sku = { _id: String(found._id), name: found.name };
                        tierSkuIds.add(String(found._id));
                    }
                }

                // Compute costs from lineItems and labor
                let materialCost = 0;
                let packagingCost = 0;
                let laborCost = 0;

                if (o.lineItems && Array.isArray(o.lineItems)) {
                    for (const li of o.lineItems) {
                        const bomQty = (li.recipeQty || 0) * (o.qty || 0);
                        const sa = li.sa ? li.sa / 100 : 0;
                        const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                        const qtyScrapped = li.qtyScrapped || 0;
                        const totalQty = bomQty + qtyExtra + qtyScrapped;
                        const unitCost = li.cost || 0;
                        const lineCost = totalQty * unitCost;

                        // Classify: Packaging vs Material
                        const liSkuId = String(li.sku || '');
                        const category = liSkuCategoryMap.get(liSkuId) || '';
                        if (category === 'Packaging') {
                            packagingCost += lineCost;
                        } else {
                            materialCost += lineCost;
                        }
                    }
                }

                if (o.labor && Array.isArray(o.labor)) {
                    for (const l of o.labor) {
                        laborCost += parseDur(l.duration) * (l.hourlyRate || 0);
                    }
                }

                o.materialCost = materialCost;
                o.packagingCost = packagingCost;
                o.laborCost = laborCost;
                o.totalCost = materialCost + packagingCost + laborCost;

                // Strip heavy arrays from response
                delete o.lineItems;
                delete o.labor;
                delete o.recipesId;
            });

            const tiers = await getSkuTiers(Array.from(tierSkuIds));
            orders.forEach((o: any) => {
                if (o.sku && typeof o.sku === 'object') {
                    o.sku.tier = tiers[(o.sku._id || o.sku).toString()];
                }
            });

            return NextResponse.json({ orders, total: orders.length });
        }

        // ─── STANDARD PATH: Paginated with server-side search ────────────────
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const sku = searchParams.get('sku');
        const createdBy = searchParams.get('createdBy');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        let query: any = {};

        // If searching, first find matching SKU IDs by name
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

        if (sku) {
            query.sku = { $in: sku.split(',') };
        }

        if (createdBy) {
            query.createdBy = { $in: createdBy.split(',') };
        }

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        // Apply Global Date Filter
        query = await applyDateFilter(query, 'createdAt');

        const total = await Manufacturing.countDocuments(query);

        let orders: any[];

        if (sortBy === 'label') {
            // Label is stored as string but represents a number — use aggregation for numeric sort
            orders = await Manufacturing.aggregate([
                { $match: query },
                { $addFields: { _numericLabel: { $toInt: { $ifNull: ['$label', '0'] } } } },
                { $sort: { _numericLabel: sortOrder as 1 | -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit },
                { $project: { _numericLabel: 0 } }
            ]);
            // Manually populate since aggregate doesn't support populate
            await Manufacturing.populate(orders, [
                { path: 'createdBy', select: 'firstName lastName' },
                { path: 'finishedBy', select: 'firstName lastName' },
            ]);
        } else {
            orders = await Manufacturing.find(query)
                .populate('createdBy', 'firstName lastName')
                .populate('finishedBy', 'firstName lastName')
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();
        }

        // Manual SKU hydration using native driver (handles String _id, ObjectId _id, and legacyId)
        const rawSkuIds = new Set<string>();
        orders.forEach((o: any) => {
            if (o.sku) rawSkuIds.add(String(o.sku));
            o.lineItems?.forEach((li: any) => { if (li.sku) rawSkuIds.add(String(li.sku)); });
        });

        const db = mongoose.connection.db;
        let skuById = new Map<string, any>();
        let skuByLegacy = new Map<string, any>();

        if (db && rawSkuIds.size > 0) {
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
            } as any, { projection: { _id: 1, name: 1, image: 1, category: 1, legacyId: 1 } }).toArray();

            allSkus.forEach((s: any) => {
                skuById.set(String(s._id), s);
                if (s.legacyId) skuByLegacy.set(String(s.legacyId), s);
            });
        }

        // Hydrate orders with SKU data
        orders.forEach((o: any) => {
            if (!o.sku) return;
            const skuStr = String(o.sku);
            const found = skuById.get(skuStr) || skuByLegacy.get(skuStr);
            if (found) {
                o.sku = { _id: String(found._id), name: found.name };
            }
        });

        // Enrich with Tiers
        const allSkuIds = new Set<string>();
        orders.forEach((o: any) => {
            if (o.sku) {
                const id = (typeof o.sku === 'object' ? (o.sku._id || o.sku) : o.sku).toString();
                allSkuIds.add(id);
            }
        });
        const tiers = await getSkuTiers(Array.from(allSkuIds));
        orders.forEach((o: any) => {
            if (o.sku && typeof o.sku === 'object') {
                o.sku.tier = tiers[(o.sku._id || o.sku).toString()];
            }
        });

        return NextResponse.json({
            orders,
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

        // Auto-generate label: find the highest numeric label and increment
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

        // Background sync to AppSheet using Next.js after()
        after(async () => {
            try {
                await dbConnect();
                const populatedOrder: any = await Manufacturing.findById(newItem._id)
                    .populate('createdBy', 'firstName lastName email')
                    .populate('finishedBy', 'firstName lastName email')
                    .lean();

                if (populatedOrder) {
                    // Hydrate SKU with legacyId for AppSheet mapping
                    if (populatedOrder.sku) {
                        const skuDoc = await Sku.findById(populatedOrder.sku).select('name legacyId').lean();
                        if (skuDoc) {
                            (populatedOrder as any).sku = skuDoc;
                        }
                    }
                    // Sync parent order FIRST, then line items (parent must exist before children)
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
