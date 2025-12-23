import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import PurchaseOrder from '@/models/PurchaseOrder';
import Sku from '@/models/Sku';
import Vendor from '@/models/Vendor';
import { applyDateFilter } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        void Sku; // Ensure Sku model is registered
        void Vendor; // Ensure Vendor model is registered

        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const vendor = searchParams.get('vendor');
        const status = searchParams.get('status');
        const createdBy = searchParams.get('createdBy');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        let query: any = {};

        if (search) {
            query.$or = [
                { label: { $regex: search, $options: 'i' } },
                // removed vendor regex search as it is now a reference
                { '_id': { $regex: search, $options: 'i' } }
            ];
        }

        if (vendor) {
            query.vendor = { $in: vendor.split(',') };
        }

        if (status) {
            query.status = { $in: status.split(',') };
        }

        if (createdBy) {
            query.createdBy = { $in: createdBy.split(',') };
        }

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        // Apply Global Date Filter
        query = await applyDateFilter(query, 'createdAt');

        const [total, orders] = await Promise.all([
            PurchaseOrder.countDocuments(query),
            PurchaseOrder.find(query)
                .populate('createdBy', 'firstName lastName')
                .populate('vendor', 'name')
                .sort({ [sortBy]: sortOrder as any })
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

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const newItem = await PurchaseOrder.create(body);
        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
