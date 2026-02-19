import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import PurchaseOrder from '@/models/PurchaseOrder';
import Sku from '@/models/Sku';
import Vendor from '@/models/Vendor';
import User from '@/models/User';
import { applyDateFilter } from '@/lib/global-settings';
import { buildFuzzySearchQuery, buildFuzzyRegex } from '@/lib/fuzzy-search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        void Sku; // Ensure Sku model is registered
        void Vendor; // Ensure Vendor model is registered
        void User; // Ensure RXHQUsers model is registered

        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '25');
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
            const fuzzyRegex = buildFuzzyRegex(search);
            const matchingVendors = await Vendor.find(
                { name: { $regex: fuzzyRegex, $options: 'i' } },
                { _id: 1 }
            ).lean();
            const matchingVendorIds = matchingVendors.map((v: any) => v._id);

            const fuzzyQuery = buildFuzzySearchQuery(search, ['label', 'legacyId', 'paymentTerms', 'status', 'lineItems.lotNumber', 'lineItems.uom']);
            if (fuzzyQuery) {
                query.$and = fuzzyQuery.$and.map((cond: any) => ({
                    $or: [
                        ...cond.$or,
                        ...(matchingVendorIds.length > 0 ? [{ vendor: { $in: matchingVendorIds } }] : [])
                    ]
                }));
            }
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

        // Get logged-in user for createdBy
        const session = await getServerSession(authOptions);
        const userEmail = session?.user?.email || '';
        if (session?.user && (session.user as any).id) {
            body.createdBy = (session.user as any).id;
        }

        const newItem = await PurchaseOrder.create(body);

        // Background sync to AppSheet (non-blocking)
        const populated = await PurchaseOrder.findById((newItem as any)._id)
            .populate('vendor', 'name legacyId')
            .populate('createdBy', 'firstName lastName email')
            .populate('lineItems.sku', 'name legacyId')
            .lean();
        if (populated) {
            // Override createdBy email from session (in case populate didn't resolve it)
            const syncData = { ...populated, _sessionEmail: userEmail };
            const { syncPurchaseOrderToAppSheet } = await import('@/lib/appsheet');
            syncPurchaseOrderToAppSheet(syncData, 'Add').catch(err =>
                console.error('Background PO AppSheet sync failed:', err)
            );
        }

        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
