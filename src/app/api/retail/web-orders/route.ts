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
        const sku = searchParams.get('sku') || '';
        const website = searchParams.get('website') || '';
        const fromDate = searchParams.get('fromDate') || '';
        const toDate = searchParams.get('toDate') || '';
        const search = searchParams.get('search') || '';
        
        let query: any = {};

        if (search) {
             query.$or = [
                { _id: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        if (sku) {
            const skus = sku.split(',');
            query['lineItems.sku'] = { $in: skus };
        }

        if (website) {
            const websites = website.split(',');
            query['lineItems.website'] = { $in: websites };
        }

        const status = searchParams.get('status') || '';
        if (status) {
            const statuses = status.split(',');
            // Case-insensitive match if needed, but for now exact match or $in
            // Use regex for case insensitivity if statuses are messy, but $in is faster.
            // Let's assume standard statuses but support Case variations if needed.
            // Check if frontend sends consistent casing. Usually safer to allow exact match first.
            query.status = { $in: statuses };
        }

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const [total, orders] = await Promise.all([
            WebOrder.countDocuments(query),
            WebOrder.find(query)
                .sort({ createdAt: -1 })
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
