import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const website = searchParams.get('website') || '';
        const fromDate = searchParams.get('fromDate') || '';
        const toDate = searchParams.get('toDate') || '';
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';
        const sortBy = searchParams.get('sortBy') || 'dateCreated';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
        
        let query: any = {};

        if (search) {
             query.$or = [
                { _id: { $regex: search, $options: 'i' } },
                { number: { $regex: search, $options: 'i' } },
                { 'billing.firstName': { $regex: search, $options: 'i' } },
                { 'billing.lastName': { $regex: search, $options: 'i' } },
                { 'billing.email': { $regex: search, $options: 'i' } },
                { 'billing.phone': { $regex: search, $options: 'i' } }
            ];
        }

        if (website) {
            const websites = website.split(',');
            query.website = { $in: websites };
        }

        if (status) {
            const statuses = status.split(',');
            query.status = { $in: statuses };
        }

        if (fromDate || toDate) {
            query.dateCreated = {};
            if (fromDate) query.dateCreated.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query.dateCreated.$lte = end;
            }
        }

        const sortQuery: any = {};
        sortQuery[sortBy] = sortOrder;

        const [total, orders] = await Promise.all([
            WebOrder.countDocuments(query),
            WebOrder.find(query)
                .sort(sortQuery)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

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
