import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TimeSheet from '@/models/TimeSheet';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const sortBy = searchParams.get('sortBy') || 'date';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
        const search = searchParams.get('search') || '';
        const user = searchParams.get('user') || '';
        const fromDate = searchParams.get('fromDate') || '';
        const toDate = searchParams.get('toDate') || '';

        let query: any = {};
        if (search) {
            query.$or = [
                { user: { $regex: search, $options: 'i' } },
                { createdBy: { $regex: search, $options: 'i' } },
            ];
        }
        if (user) {
            query.user = user;
        }
        if (fromDate || toDate) {
            query.date = {};
            if (fromDate) query.date.$gte = new Date(fromDate);
            if (toDate) query.date.$lte = new Date(toDate);
        }

        const [total, timesheets] = await Promise.all([
            TimeSheet.countDocuments(query),
            TimeSheet.find(query)
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        return NextResponse.json({
            timesheets,
            total,
            page,
            hasMore: page * limit < total,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();

        const entry = await TimeSheet.create(body);
        return NextResponse.json(entry, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
