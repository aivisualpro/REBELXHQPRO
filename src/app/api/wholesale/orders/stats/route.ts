import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Client from '@/models/Client';
import mongoose from 'mongoose';
import { applyDateFilter } from '@/lib/global-settings';
import { buildFuzzySearchQuery } from '@/lib/fuzzy-search';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET — Aggregated stats for wholesale orders based on current filters.
// Returns:  { count, totalRevenue, totalCost, totalBalance, totalMargin }
//
// Uses MongoDB aggregation pipeline with $addFields for computed columns
// so that stats accurately reflect the FULL filtered dataset, not just the
// visible page of results.
// ═══════════════════════════════════════════════════════════════════════════════

let indexEnsured = false;

export async function GET(request: Request) {
    try {
        await dbConnect();
        void Client;

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status');
        const client = searchParams.get('client');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        // Ensure compound index for fast filtering (once per cold start)
        if (!indexEnsured) {
            indexEnsured = true;
            try {
                const db = mongoose.connection.db;
                if (db) {
                    await db.collection('saleorders').createIndex(
                        { orderStatus: 1, createdAt: -1 },
                        { background: true }
                    );
                }
            } catch { /* index may already exist */ }
        }

        // ─── Build Match Query (same logic as main orders GET) ──────────
        let query: any = {};

        if (search) {
            const trimmedSearch = search.trim();
            const isNumericSearch = /^\d+$/.test(trimmedSearch);

            if (isNumericSearch) {
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

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        // Apply global date filter when not client-scoped
        if (!client) {
            query = await applyDateFilter(query, 'createdAt');
        }

        // ─── Aggregation Pipeline ───────────────────────────────────────
        const pipeline: any[] = [
            { $match: query },
            {
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
            },
            {
                $addFields: {
                    _grandTotal: {
                        $subtract: [
                            { $add: ['$_subtotal', { $ifNull: ['$shippingCost', 0] }, { $ifNull: ['$tax', 0] }] },
                            { $ifNull: ['$discount', 0] }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    _balance: { $subtract: ['$_grandTotal', '$_totalPayments'] },
                    _margin: { $subtract: ['$_grandTotal', '$_cost'] }
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$_grandTotal' },
                    totalCost: { $sum: '$_cost' },
                    totalBalance: { $sum: '$_balance' },
                    totalMargin: { $sum: '$_margin' },
                    totalShipping: { $sum: { $ifNull: ['$shippingCost', 0] } },
                    totalDiscount: { $sum: { $ifNull: ['$discount', 0] } },
                    totalTax: { $sum: { $ifNull: ['$tax', 0] } },
                }
            }
        ];

        const results = await SaleOrder.aggregate(pipeline);
        const stats = results[0] || {
            count: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalBalance: 0,
            totalMargin: 0,
            totalShipping: 0,
            totalDiscount: 0,
            totalTax: 0,
        };

        // Remove the _id null field
        delete stats._id;

        return NextResponse.json(stats);
    } catch (error: any) {
        console.error('Wholesale stats error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
