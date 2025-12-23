import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';

import { applyDateFilter } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limitParam = searchParams.get('limit');
        const limit = limitParam === '0' ? 0 : parseInt(limitParam || '20');
        const sortBy = searchParams.get('sortBy') || 'name';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const category = searchParams.get('category');
        const subCategory = searchParams.get('subCategory');
        const materialType = searchParams.get('materialType');

        let query: any = {};
        
        // Apply Global Date Filter (unless ignored for dropdowns)
        const ignoreDate = searchParams.get('ignoreDate') === 'true';
        if (!ignoreDate) {
            query = await applyDateFilter(query, 'createdAt');
        }

const escapeRegex = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

        if (search) {
            const escapedSearch = escapeRegex(search);
            query.$or = [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { _id: { $regex: escapedSearch, $options: 'i' } } // Search by SKU (which is _id)
            ];
        }

        if (category) {
            query.category = { $in: category.split(',') };
        }
        if (subCategory) {
            query.subCategory = { $in: subCategory.split(',') };
        }
        if (materialType) {
            query.materialType = { $in: materialType.split(',') };
        }

        const queryObj = Sku.find(query).sort({ [sortBy]: sortOrder as any });

        if (limit > 0) {
            queryObj.skip((page - 1) * limit).limit(limit);
        }

        const [total, skus] = await Promise.all([
            Sku.countDocuments(query),
            queryObj.lean()
        ]);

        return NextResponse.json({
            skus,
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

        // _id will be auto-generated if not provided, or mapped from sku if present
        const skuData = { ...body };
        if (body.sku) skuData._id = body.sku;
        const newSku = await Sku.create(skuData);
        return NextResponse.json(newSku);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
