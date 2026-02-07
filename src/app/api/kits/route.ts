import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Kit } from '@/models/Kit';
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

        const skip = (page - 1) * limit;

        const kits = await Kit.find(query)
            .populate('lineItems.sku', 'name')
            .populate('createdBy', 'firstName lastName')
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit);

        const total = await Kit.countDocuments(query);

        return NextResponse.json({
            kits,
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
        const newKit = await Kit.create(body);
        return NextResponse.json(newKit);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
