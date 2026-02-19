import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import OpeningBalance from '@/models/OpeningBalance';
import Sku from '@/models/Sku'; // Ensure Sku model is registered
import User from '@/models/User'; // Ensure User model is registered
import mongoose from 'mongoose';
import { buildFuzzySearchQuery, buildFuzzyRegex } from '@/lib/fuzzy-search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limitParam = searchParams.get('limit');
        const limit = limitParam === '0' ? 0 : parseInt(limitParam || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
        const search = searchParams.get('search') || '';

        const skuFilter = searchParams.get('sku');

        let query: any = {};

        if (search) {
            // Find SKUs with matching names using raw driver for cross-type matching
            const fuzzyRegex = buildFuzzyRegex(search);
            const db = mongoose.connection.db;
            let matchingSkuIds: any[] = [];
            if (db) {
                const matchedSkus = await db.collection('skus').find(
                    { name: { $regex: fuzzyRegex, $options: 'i' } },
                    { projection: { _id: 1 } }
                ).toArray();
                // Include both string and ObjectId forms for cross-type matching
                matchedSkus.forEach(s => {
                    matchingSkuIds.push(s._id);
                    matchingSkuIds.push(s._id.toString());
                });
            }

            const fuzzyQuery = buildFuzzySearchQuery(search, ['lotNumber']);
            if (fuzzyQuery) {
                query.$and = fuzzyQuery.$and.map((cond: any) => ({
                    $or: [
                        ...cond.$or,
                        ...(matchingSkuIds.length > 0 ? [{ sku: { $in: matchingSkuIds } }] : [])
                    ]
                }));
            }
        }

        if (skuFilter) {
            query.sku = skuFilter;
        }

        const queryObj = OpeningBalance.find(query)
            .sort({ [sortBy]: sortOrder as any });

        if (limit > 0) {
            queryObj.skip((page - 1) * limit).limit(limit);
        }

        const [total, rawBalances] = await Promise.all([
            OpeningBalance.countDocuments(query),
            queryObj.lean()
        ]);

        // Build SKU lookup using raw MongoDB driver with cross-type matching
        const skuIds = [...new Set(rawBalances.map((b: any) => b.sku?.toString()).filter(Boolean))];
        
        let skuMap = new Map<string, { name: string; image: string }>();
        
        if (skuIds.length > 0) {
            const db = mongoose.connection.db;
            if (db) {
                // Try both string and ObjectId forms to handle type mismatches
                const lookupIds: any[] = [];
                skuIds.forEach(id => {
                    lookupIds.push(id); // string form
                    if (mongoose.Types.ObjectId.isValid(id)) {
                        lookupIds.push(new mongoose.Types.ObjectId(id)); // ObjectId form
                    }
                });

                const skuDocs = await db.collection('skus').find(
                    { _id: { $in: lookupIds } },
                    { projection: { _id: 1, name: 1, image: 1 } }
                ).toArray();
                
                skuDocs.forEach((s: any) => {
                    skuMap.set(s._id.toString(), { name: s.name || '', image: s.image || '' });
                });
            }
        }

        const openingBalances = rawBalances.map((b: any) => {
            const skuData = b.sku ? skuMap.get(b.sku.toString()) : null;
            return {
                ...b,
                sku: b.sku ? { _id: b.sku.toString(), name: skuData?.name || b.sku.toString(), image: skuData?.image || '' } : b.sku
            };
        });

        console.log('GET /opening-balances query:', JSON.stringify(query));
        console.log('GET Opening Balances Total:', total);
        console.log('GET Opening Balances Found:', openingBalances.length);
        if (skuIds.length > 0) {
            console.log('SKU lookup: requested', skuIds.length, 'found', skuMap.size);
        }

        return NextResponse.json({
            openingBalances,
            total,
            page,
            totalPages: limit > 0 ? Math.ceil(total / limit) : 1
        });
    } catch (error: any) {
        console.error('GET /opening-balances Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const newItem = await OpeningBalance.create(body);
        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
