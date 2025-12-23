import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import AuditAdjustment from '@/models/AuditAdjustment';
import Sku from '@/models/Sku';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const limitQuery = searchParams.get('limit'); // Check if limit was explicitly passed (e.g. for dropdowns)

        let query: any = {};

        if (search) {
             // We can't easily regex search on ObjectId refs without aggregation, 
             // but we can search on reason or lotNumber directly.
             // Or find SKUs that match name and use their IDs.
             const matchingSkus = await Sku.find({ name: { $regex: search, $options: 'i' } }).select('_id');
             const skuIds = matchingSkus.map(s => s._id);

             query.$or = [
                { lotNumber: { $regex: search, $options: 'i' } },
                { reason: { $regex: search, $options: 'i' } },
                { sku: { $in: skuIds } }
            ];
        }

        const effectiveLimit = limitQuery ? parseInt(limitQuery) : limit;

        const [total, adjustments] = await Promise.all([
            AuditAdjustment.countDocuments(query),
            AuditAdjustment.find(query)
                .populate('sku', 'name uom')
                .populate('createdBy', 'firstName lastName email') // Populate user details
                .sort({ createdAt: -1 })
                .skip((page - 1) * effectiveLimit)
                .limit(effectiveLimit)
                .lean()
        ]);

        return NextResponse.json({
            adjustments,
            total,
            page,
            totalPages: Math.ceil(total / effectiveLimit)
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { sku, lotNumber, qty, reason, createdBy } = body;

        if (!sku || qty === undefined || !createdBy) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const adjustment = await AuditAdjustment.create({
            sku, // Can be ID or String due to Mixed type
            lotNumber,
            qty: parseFloat(qty),
            reason,
            createdBy // Can be ID or String
        });

        return NextResponse.json({ adjustment }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
