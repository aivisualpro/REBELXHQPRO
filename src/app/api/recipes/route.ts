import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Recipe } from '@/models/Recipe';
import Sku from '@/models/Sku';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        void Sku;
        void User;

        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        let query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } }
            ];
        }

        const skuFilter = searchParams.get('sku');
        if (skuFilter) {
            const matchingSkus = await Sku.find({ name: { $regex: skuFilter, $options: 'i' } }).select('_id');
            const skuIds = matchingSkus.map(s => s._id); // Assuming _id is string or ObjectId compatible
            query.sku = { $in: skuIds };
        }

        const createdByFilter = searchParams.get('createdBy');
        if (createdByFilter) {
            const matchingUsers = await User.find({
                $or: [
                    { firstName: { $regex: createdByFilter, $options: 'i' } },
                    { lastName: { $regex: createdByFilter, $options: 'i' } }
                ]
            }).select('_id');
            const userIds = matchingUsers.map(u => u._id);
            query.createdBy = { $in: userIds };
        }

        const skip = (page - 1) * limit;

        const recipesRaw = await Recipe.find(query)
            .populate('createdBy', 'firstName lastName')
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Recipe.countDocuments(query);

        // Manual SKU hydration via Sku model's native collection (handles String vs ObjectId mismatch)
        const skuIds = [...new Set(recipesRaw.map((r: any) => r.sku ? String(r.sku) : null).filter(Boolean))] as string[];
        const skuMap = new Map<string, { _id: string; name: string }>();

        if (skuIds.length > 0) {
            const mongoose = (await import('mongoose')).default;

            // Build $or query to match both String and ObjectId _id types
            const orConditions: any[] = [
                { _id: { $in: skuIds } }
            ];
            const validOids = skuIds.filter(id => /^[0-9a-f]{24}$/i.test(id));
            if (validOids.length > 0) {
                orConditions.push({ _id: { $in: validOids.map(id => new mongoose.Types.ObjectId(id)) } });
            }

            try {
                const skuDocs = await Sku.collection.find(
                    { $or: orConditions },
                    { projection: { _id: 1, name: 1 } }
                ).toArray();

                skuDocs.forEach((s: any) => {
                    skuMap.set(String(s._id), { _id: String(s._id), name: s.name });
                });
            } catch (err) {
                console.error('SKU hydration error:', err);
            }
        }

        const recipes = recipesRaw.map((r: any) => {
            const skuId = r.sku?.toString();
            const skuDoc = skuId ? skuMap.get(skuId) : null;
            return {
                ...r,
                sku: skuDoc ? { _id: skuDoc._id, name: skuDoc.name } : r.sku
            };
        });

        return NextResponse.json({
            recipes,
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
        const newItem = await Recipe.create(body);
        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
