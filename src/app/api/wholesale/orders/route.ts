import { NextRequest, NextResponse, after } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Counter from '@/models/Counter';
import Sku from '@/models/Sku';
import Client from '@/models/Client';
import RXHQUsers from '@/models/User';
import { applyDateFilter } from '@/lib/global-settings';
import { syncOrderToAppSheet } from '@/lib/appsheet';
import { buildFuzzySearchQuery, buildFuzzyRegex } from '@/lib/fuzzy-search';
import mongoose from 'mongoose';
import { getSessionFieldMap, applyOrderFieldGuard } from '@/lib/workspace-field-guard';

/**
 * Atomically generates the next sale order label.
 * Seeds the counter from the highest existing numeric label on first use.
 * Uses MongoDB findOneAndUpdate $inc — race-condition-safe under concurrent requests.
 */
async function getNextOrderLabel(): Promise<string> {
    // Seed the counter if it doesn't exist yet
    const existing = await Counter.findById('saleOrderLabel');
    if (!existing) {
        // Find the highest numeric label currently in the collection
        const lastOrder = await SaleOrder.findOne(
            { label: { $regex: /^\d+$/ } },
            { label: 1 }
        ).sort({ label: -1 }).lean() as { label?: string } | null;

        const highestSeen = lastOrder?.label ? parseInt(lastOrder.label, 10) : 53001;

        // upsert so two concurrent "first calls" don't both try to insert
        await Counter.findOneAndUpdate(
            { _id: 'saleOrderLabel' },
            { $setOnInsert: { seq: highestSeen } },
            { upsert: true, new: false }
        );
    }

    const counter = await Counter.findOneAndUpdate(
        { _id: 'saleOrderLabel' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    return String(counter.seq);
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
            const trimmedSearch = search.trim();
            const isNumericSearch = /^\d+$/.test(trimmedSearch);

            if (isNumericSearch) {
                // Exact match for order numbers — search for label that equals or starts with the number
                query.$or = [
                    { label: trimmedSearch },
                    { label: { $regex: `^${trimmedSearch}`, $options: 'i' } }
                ];
            } else {
                const clientSearchQuery = buildFuzzySearchQuery(search, ['name']);
                const matchingClients = clientSearchQuery
                    ? await Client.find(clientSearchQuery, { _id: 1 }).lean()
                    : [];
                const matchingClientIds = matchingClients.map((c: any) => c._id);

                const fuzzyQuery = buildFuzzySearchQuery(search, ['label', 'paymentMethod']);
                if (fuzzyQuery) {
                    query.$and = fuzzyQuery.$and.map((cond: any) => ({
                        $or: [
                            ...cond.$or,
                            ...(matchingClientIds.length > 0 ? [{ clientId: { $in: matchingClientIds } }] : [])
                        ]
                    }));
                }
            }
        }

        if (client) {
            query.clientId = {
                $in: client.split(',').map(id => {
                    try { return new mongoose.Types.ObjectId(id); } catch { return id; }
                })
            };
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

        // Only apply the global date filter when NOT scoped to a specific client.
        // When viewing a client's orders, show ALL orders regardless of date.
        if (!client) {
            query = await applyDateFilter(query, 'createdAt');
        }

        // Computed columns that need aggregation-based sorting
        const COMPUTED_SORT_COLUMNS = new Set(['subtotal', 'grandTotal', 'balance', 'cost', 'margin']);

        if (COMPUTED_SORT_COLUMNS.has(sortBy)) {
            // Use aggregation pipeline for computed column sorting
            const pipeline: any[] = [];

            // Match stage
            pipeline.push({ $match: query });

            // Add computed fields
            pipeline.push({
                $addFields: {
                    _subtotal: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$lineItems', []] },
                                as: 'item',
                                in: { $multiply: [{ $ifNull: ['$$item.qtyShipped', 0] }, { $ifNull: ['$$item.price', 0] }] }
                            }
                        }
                    },
                    _cost: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$lineItems', []] },
                                as: 'item',
                                in: { $multiply: [{ $ifNull: ['$$item.qtyShipped', 0] }, { $ifNull: ['$$item.cost', 0] }] }
                            }
                        }
                    },
                    _totalPayments: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$payments', []] },
                                as: 'p',
                                in: { $ifNull: ['$$p.paymentAmount', 0] }
                            }
                        }
                    }
                }
            });

            // Add grandTotal, balance, margin
            pipeline.push({
                $addFields: {
                    _grandTotal: {
                        $subtract: [
                            { $add: ['$_subtotal', { $ifNull: ['$shippingCost', 0] }, { $ifNull: ['$tax', 0] }] },
                            { $ifNull: ['$discount', 0] }
                        ]
                    }
                }
            });

            pipeline.push({
                $addFields: {
                    _balance: { $subtract: ['$_grandTotal', '$_totalPayments'] },
                    _margin: { $subtract: ['$_grandTotal', '$_cost'] }
                }
            });

            // Map sortBy to computed field name
            const sortFieldMap: Record<string, string> = {
                subtotal: '_subtotal',
                grandTotal: '_grandTotal',
                balance: '_balance',
                cost: '_cost',
                margin: '_margin'
            };

            // Count total (use a facet or separate count)
            const countResult = await SaleOrder.countDocuments(query);

            // Sort, skip, limit
            pipeline.push({ $sort: { [sortFieldMap[sortBy]]: sortOrder } });
            pipeline.push({ $skip: (page - 1) * limit });
            pipeline.push({ $limit: limit });

            // Remove computed fields from output
            pipeline.push({
                $project: {
                    _subtotal: 0,
                    _cost: 0,
                    _totalPayments: 0,
                    _grandTotal: 0,
                    _balance: 0,
                    _margin: 0
                }
            });

            let orders = await SaleOrder.aggregate(pipeline);

            // Populate references after aggregation
            orders = await SaleOrder.populate(orders, [
                { path: 'clientId', select: 'name' },
                { path: 'salesRep', select: 'firstName lastName' },
                { path: 'lineItems.sku', select: 'name' }
            ]);

            // ── Field guard: strip workspace-hidden fields from each order ──
            const [listOrderFM, listLineItemFM] = await Promise.all([
                getSessionFieldMap(request, 'wholesale-orders'),
                getSessionFieldMap(request, 'wo-lineitems'),
            ]);
            if (listOrderFM || listLineItemFM) {
                orders = orders.map((o: any) =>
                    applyOrderFieldGuard(o, listOrderFM || {}, listLineItemFM || {})
                );
            }

            return NextResponse.json({
                orders,
                total: countResult,
                page,
                hasMore: page * limit < countResult,
                totalPages: Math.ceil(countResult / limit)
            });
        }

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

        // ── Field guard: strip workspace-hidden fields from each order ──
        const [listOrderFM2, listLineItemFM2] = await Promise.all([
            getSessionFieldMap(request, 'wholesale-orders'),
            getSessionFieldMap(request, 'wo-lineitems'),
        ]);
        let guardedOrders: any[] = orders as any[];
        if (listOrderFM2 || listLineItemFM2) {
            guardedOrders = guardedOrders.map((o: any) =>
                applyOrderFieldGuard(o, listOrderFM2 || {}, listLineItemFM2 || {})
            );
        }

        return NextResponse.json({
            orders: guardedOrders,
            total,
            page,
            hasMore: page * limit < total,
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

        // Always generate the label server-side — atomic & race-condition-safe.
        // Ignore any label the client may have sent to prevent duplicates.
        body.label = await getNextOrderLabel();

        if (body.lineItems && Array.isArray(body.lineItems)) {
            body.lineItems = body.lineItems.map((item: any) => ({
                ...item,
                total: (item.qtyShipped || 0) * (item.price || 0)
            }));
        }

        const newItem: any = await SaleOrder.create(body);

        // Use Next.js after() for reliable background task execution in serverless
        // This ensures AppSheet sync completes even after response is sent
        after(async () => {
            try {
                await dbConnect(); // Reconnect for background task
                const populatedOrder = await SaleOrder.findById(newItem._id)
                    .populate('clientId', 'name legacyId')
                    .populate('salesRep', 'firstName lastName email')
                    .populate('lineItems.sku', 'name legacyId');

                if (populatedOrder) {
                    await syncOrderToAppSheet(populatedOrder);
                    console.log('✅ Order synced to AppSheet:', newItem._id);
                }
            } catch (syncError) {
                console.error('❌ Background AppSheet sync failed:', syncError);
            }
        });

        return NextResponse.json(newItem);
    } catch (error: any) {
        console.error('Create order error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
