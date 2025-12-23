import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import OpeningBalance from '@/models/OpeningBalance';
import Sku from '@/models/Sku'; // Ensure Sku model is registered
import User from '@/models/User'; // Ensure User model is registered

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limitParam = searchParams.get('limit');
        const limit = limitParam === '0' ? 0 : parseInt(limitParam || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
        const search = searchParams.get('search') || '';

        const skuFilter = searchParams.get('sku');

        let query: any = {};

        if (search) {
            // Find SKUs with matching names
            const matchingSkus = await Sku.find({
                name: { $regex: search, $options: 'i' }
            }).select('_id');
            const matchingSkuIds = matchingSkus.map(s => s._id);

            query.$or = [
                { lotNumber: { $regex: search, $options: 'i' } },
                { sku: { $in: matchingSkuIds } }
            ];
        }

        if (skuFilter) {
            query.sku = skuFilter; // Exact match for ID
        }

        const queryObj = OpeningBalance.find(query)
            .populate('sku', 'name')
            .populate('createdBy', 'firstName lastName')
            .sort({ [sortBy]: sortOrder as any });

        if (limit > 0) {
            queryObj.skip((page - 1) * limit).limit(limit);
        }

        const [total, openingBalances] = await Promise.all([
            OpeningBalance.countDocuments(query),
            queryObj.lean()
        ]);

        console.log('GET /opening-balances query:', JSON.stringify(query));
        console.log('GET Opening Balances Total:', total);
        console.log('GET Opening Balances Found:', openingBalances.length);

        return NextResponse.json({
            openingBalances,
            total,
            page,
            totalPages: limit > 0 ? Math.ceil(total / limit) : 1
        });
    } catch (error: any) {
        console.error('GET /opening-balances Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const newItem = await OpeningBalance.create(body);
        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
