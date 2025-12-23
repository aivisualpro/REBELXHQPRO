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

        const recipes = await Recipe.find(query)
            .populate('sku', 'name')
            .populate('createdBy', 'firstName lastName')
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit);

        const total = await Recipe.countDocuments(query);

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
