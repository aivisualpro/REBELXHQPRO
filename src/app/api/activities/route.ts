import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Activity from '@/models/Activity';
import { buildFuzzySearchQuery } from '@/lib/fuzzy-search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const type = searchParams.get('type');
        const client = searchParams.get('client');
        const createdBy = searchParams.get('createdBy');

        let query: any = {};

        if (search) {
            const fuzzyQuery = buildFuzzySearchQuery(search, ['comments']);
            if (fuzzyQuery) Object.assign(query, fuzzyQuery);
        }

        if (type) {
            query.type = { $in: type.split(',') };
        }
        if (client) {
            query.client = { $in: client.split(',') };
        }
        if (createdBy) {
            query.createdBy = { $in: createdBy.split(',') };
        }

        const [total, activities] = await Promise.all([
            Activity.countDocuments(query),
            Activity.find(query)
                .populate('client', 'name')
                .populate('createdBy', 'firstName lastName')
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        return NextResponse.json({
            activities,
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
        const newActivity = await Activity.create(body);
        return NextResponse.json(newActivity);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
