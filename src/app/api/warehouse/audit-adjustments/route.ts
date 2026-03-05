import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import AuditAdjustment from '@/models/AuditAdjustment';
import Sku from '@/models/Sku';
import User from '@/models/User';
import { buildFuzzySearchQuery, buildFuzzyRegex } from '@/lib/fuzzy-search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        // Ensure models are registered for Vercel cold starts
        void User;

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

        let query: any = {};

        if (search) {
            const fuzzyRegex = buildFuzzyRegex(search);
            const matchingSkus = await Sku.find({ name: { $regex: fuzzyRegex, $options: 'i' } }).select('_id legacyId').lean();
            const skuIds = matchingSkus.map(s => s._id.toString());
            const skuLegacyIds = matchingSkus.map((s: any) => s.legacyId).filter(Boolean);

            const fuzzyQuery = buildFuzzySearchQuery(search, ['lotNumber', 'reason', 'createdBy']);
            // Merge fuzzy field search with SKU ID match
            if (fuzzyQuery) {
                // Each token must match in at least one place: direct fields OR sku match
                query.$and = fuzzyQuery.$and.map((cond: any) => ({
                    $or: [
                        ...cond.$or,
                        ...(skuIds.length > 0 ? [{ sku: { $in: [...skuIds, ...skuLegacyIds] } }] : [])
                    ]
                }));
            }
        }

        const sortObj: any = { [sortBy]: sortOrder };

        const [total, adjustments] = await Promise.all([
            AuditAdjustment.countDocuments(query),
            AuditAdjustment.find(query)
                .sort(sortObj)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        // Manually hydrate SKU data using raw MongoDB driver (same pattern as opening balances)
        // Mongoose populate/find can't resolve string _id refs due to BSON type mismatch
        const skuRefIds = [...new Set(adjustments.map((a: any) => a.sku?.toString()).filter(Boolean))];

        const skuMap = new Map<string, { _id: string; name: string; uom: string; image: string; tier?: number }>();

        if (skuRefIds.length > 0) {
            const db = mongoose.connection.db;
            if (db) {
                // Push both string and ObjectId forms to handle type mismatch
                const lookupIds: any[] = [];
                skuRefIds.forEach(id => {
                    lookupIds.push(id); // string form
                    if (mongoose.Types.ObjectId.isValid(id)) {
                        lookupIds.push(new mongoose.Types.ObjectId(id)); // ObjectId form
                    }
                });

                const skuDocs = await db.collection('skus').find(
                    { _id: { $in: lookupIds } },
                    { projection: { _id: 1, name: 1, uom: 1, image: 1, tier: 1 } }
                ).toArray();

                skuDocs.forEach((s: any) => {
                    skuMap.set(s._id.toString(), { _id: s._id.toString(), name: s.name || '', uom: s.uom || '', image: s.image || '', tier: s.tier });
                });
            }
        }

        // Hydrate createdBy emails to user names via rxhqusers collection
        const createdByEmails = [...new Set(adjustments.map((a: any) => a.createdBy?.toString()).filter(Boolean))];
        const userMap = new Map<string, { firstName: string; lastName: string }>();

        if (createdByEmails.length > 0) {
            const db = mongoose.connection.db;
            if (db) {
                const userDocs = await db.collection('rxhqusers').find(
                    { email: { $in: createdByEmails } },
                    { projection: { email: 1, firstName: 1, lastName: 1 } }
                ).toArray();

                userDocs.forEach((u: any) => {
                    userMap.set(u.email, { firstName: u.firstName || '', lastName: u.lastName || '' });
                });
            }
        }

        const hydratedAdjustments = adjustments.map((a: any) => {
            const skuData = skuMap.get(a.sku?.toString()) || { _id: a.sku, name: a.sku, uom: '', image: '', tier: undefined };
            const userData = userMap.get(a.createdBy?.toString());
            return {
                ...a,
                sku: skuData,
                createdBy: userData ? { firstName: userData.firstName, lastName: userData.lastName } : a.createdBy
            };
        });

        return NextResponse.json({
            adjustments: hydratedAdjustments,
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
        const { sku, lotNumber, qty, reason, createdBy } = body;

        if (!sku || qty === undefined || !createdBy) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const adjustment = await AuditAdjustment.create({
            sku, // Can be ID or String due to Mixed type
            lotNumber,
            qty: parseFloat(qty),
            reason,
            createdBy // Can be ID or String
        });

        return NextResponse.json({ adjustment }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
