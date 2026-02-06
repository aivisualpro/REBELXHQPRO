import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Sku from '@/models/Sku';
import Client from '@/models/Client';
import RXHQUsers from '@/models/User';
import { applyDateFilter } from '@/lib/global-settings';
import { syncOrderToAppSheet } from '@/lib/appsheet';

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

        query = await applyDateFilter(query, 'createdAt');

        const [total, orders] = await Promise.all([
            SaleOrder.countDocuments(query),
            SaleOrder.find(query)
                .populate('clientId', 'name')
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
        
        if (body.lineItems && Array.isArray(body.lineItems)) {
            body.lineItems = body.lineItems.map((item: any) => ({
                ...item,
                total: (item.qtyShipped || 0) * (item.price || 0)
            }));
        }

        const newItem: any = await SaleOrder.create(body);

        const populatedOrder = await SaleOrder.findById(newItem._id)
            .populate('clientId', 'name legacyId')
            .populate('salesRep', 'firstName lastName')
            .populate('lineItems.sku', 'name legacyId');

        if (populatedOrder) {
            try {
                await syncOrderToAppSheet(populatedOrder);
            } catch (syncError) {
                console.error('Failed to sync order to AppSheet:', syncError);
            }
        }

        return NextResponse.json(newItem);
    } catch (error: any) {
        console.error('Create order error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
