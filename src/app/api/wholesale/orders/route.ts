import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Sku from '@/models/Sku';
import Client from '@/models/Client'; // Assuming Client model exists
import RXHQUsers from '@/models/User';
import { applyDateFilter } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        void Sku; 
        void Client; 
        void RXHQUsers; 

        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const client = searchParams.get('client');
        const status = searchParams.get('status');
        const salesRep = searchParams.get('salesRep');
        const sku = searchParams.get('sku');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        let query: any = {};

        if (search) {
            query.$or = [
                { label: { $regex: search, $options: 'i' } },
                { '_id': { $regex: search, $options: 'i' } }
            ];
        }

        if (client) {
            query.clientId = { $in: client.split(',') };
        }

        if (status) {
            query.orderStatus = { $in: status.split(',') };
        }

        if (salesRep) {
            query.salesRep = { $in: salesRep.split(',') };
        }

        if (sku) {
            query['lineItems.sku'] = { $in: sku.split(',') };
        }

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        // Apply Global Date Filter if applicable (commented out if not needed, but good to have)
        query = await applyDateFilter(query, 'createdAt');

        const [total, orders] = await Promise.all([
            SaleOrder.countDocuments(query),
            SaleOrder.find(query)
                .populate('clientId', 'name') // Changed from 'firstName lastName businessName' to match Client schema
                .populate('salesRep', 'firstName lastName')
                .populate('lineItems.sku', 'name')
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
        
        // Ensure line items have calculated total if not provided
        if (body.lineItems && Array.isArray(body.lineItems)) {
            body.lineItems = body.lineItems.map((item: any) => ({
                ...item,
                total: (item.qtyShipped || 0) * (item.price || 0)
            }));
        }

        const newItem = await SaleOrder.create(body);
        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
