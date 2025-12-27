import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import Sku from '@/models/Sku';
import { applyDateFilter } from '@/lib/global-settings';
import { getSkuTiers } from '@/lib/sku-tiers';

export async function GET(request: Request) {
    try {
        await dbConnect();
        // Ensure models are registered
        void Sku;

        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const sku = searchParams.get('sku');
        const createdBy = searchParams.get('createdBy');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        let query: any = {};

        // If searching, first find matching SKU IDs by name
        let matchingSkuIds: string[] = [];
        if (search) {
            const matchingSkus = await Sku.find({
                name: { $regex: search, $options: 'i' }
            }).select('_id').lean();
            matchingSkuIds = matchingSkus.map((s: any) => s._id);
            
            query.$or = [
                { label: { $regex: search, $options: 'i' } }, // Search by label
                { '_id': { $regex: search, $options: 'i' } }, // or WO ID
                ...(matchingSkuIds.length > 0 ? [{ sku: { $in: matchingSkuIds } }] : [])
            ];
        }

        if (sku) {
            query.sku = { $in: sku.split(',') };
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

        const total = await Manufacturing.countDocuments(query);
        const orders = await Manufacturing.find(query)
                .populate('sku', 'name')
                .populate('createdBy', 'firstName lastName')
                .populate('finishedBy', 'firstName lastName')
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

        // Return orders with their stored cost values (set by sync-costs API)
        // No on-the-fly calculation - costs are synced via the global Sync Costs button

        // Enrich with Tiers
        const allSkuIds = new Set<string>();
        orders.forEach((o: any) => { if (o.sku) allSkuIds.add((o.sku._id || o.sku).toString()); });
        const tiers = await getSkuTiers(Array.from(allSkuIds));
        orders.forEach((o: any) => {
            if (o.sku && typeof o.sku === 'object') {
                o.sku.tier = tiers[(o.sku._id || o.sku).toString()];
            }
        });

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
        const newItem = await Manufacturing.create(body);
        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
