import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Vendor from '@/models/Vendor';

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

        const city = searchParams.get('city');
        const state = searchParams.get('state');
        const status = searchParams.get('status');

        let query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { contactName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        if (city) query.city = { $in: city.split(',') };
        if (state) query.state = { $in: state.split(',') };
        if (status) query.status = { $in: status.split(',') };

        const [total, vendors] = await Promise.all([
            Vendor.countDocuments(query),
            Vendor.find(query)
                .populate('createdBy', 'firstName lastName')
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        return NextResponse.json({
            vendors,
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
        const newVendor = await Vendor.create(body);
        return NextResponse.json(newVendor);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
