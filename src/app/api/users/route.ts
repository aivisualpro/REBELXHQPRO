import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { applyDateFilter } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const conn = await dbConnect();

        if (!conn) {
            throw new Error("Database connection failed");
        }

        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'firstName';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        let query: any = search ? {
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } },
            ]
        } : {};

        // Apply Global Date Filter
        query = await applyDateFilter(query, 'createdAt');

        const [total, users] = await Promise.all([
            User.countDocuments(query),
            User.find(query)
                .select('-password -createdAt -updatedAt -__v')
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        return NextResponse.json({
            users,
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

        // Ensure email as ID for new manual entries as well, for consistency
        const newUser = await User.create({
            _id: body.email,
            ...body
        });

        return NextResponse.json(newUser);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
