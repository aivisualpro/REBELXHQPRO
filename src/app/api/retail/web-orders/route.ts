import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import { buildFuzzySearchQuery } from '@/lib/fuzzy-search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const website = searchParams.get('website') || '';
        const fromDate = searchParams.get('fromDate') || '';
        const toDate = searchParams.get('toDate') || '';
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';
        const productId = searchParams.get('productId') || '';
        const variationId = searchParams.get('variationId') || '';
        const sortBy = searchParams.get('sortBy') || 'dateCreated';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

        let query: any = {};

        if (search) {
            const isNumeric = /^\d+$/.test(search.trim());
            if (isNumeric) {
                // For numeric searches, do exact substring match on number/_id fields
                const exactPattern = search.trim();
                query.$or = [
                    { number: { $regex: exactPattern, $options: 'i' } },
                    { _id: { $regex: exactPattern, $options: 'i' } },
                    { 'billing.phone': { $regex: exactPattern, $options: 'i' } },
                ];
            } else {
                // For text searches, use fuzzy matching on name/email fields
                const fuzzyQuery = buildFuzzySearchQuery(search, ['_id', 'number', 'billing.firstName', 'billing.lastName', 'billing.email', 'billing.phone']);
                if (fuzzyQuery) Object.assign(query, fuzzyQuery);
            }
        }

        if (website) {
            const websites = website.split(',');
            query.website = { $in: websites };
        }

        if (status) {
            const statuses = status.split(',');
            query.status = { $in: statuses };
        }

        if (fromDate || toDate) {
            query.dateCreated = {};
            if (fromDate) query.dateCreated.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query.dateCreated.$lte = end;
            }
        }

        // Filter by product/variation in line items
        if (productId) {
            const pid = parseInt(productId);
            query['lineItems.productId'] = isNaN(pid) ? productId : pid;
            if (variationId) {
                const vid = parseInt(variationId);
                query['lineItems.variationId'] = isNaN(vid) ? variationId : vid;
            }
        }

        const sortQuery: any = {};
        sortQuery[sortBy] = sortOrder;

        const [total, orders] = await Promise.all([
            WebOrder.countDocuments(query),
            WebOrder.find(query)
                .sort(sortQuery)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        return NextResponse.json({
            orders,
            total,
            page,
            hasMore: page * limit < total,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
