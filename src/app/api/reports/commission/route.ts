import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Client from '@/models/Client';
import Sku from '@/models/Sku';
import RXHQUsers from '@/models/User';

export const dynamic = 'force-dynamic';

/**
 * Commission Report API
 * Fetches wholesale orders and calculates 5% commission per sales rep.
 * Supports filtering by salesRep, date range (non-timezone-based).
 */
export async function GET(request: Request) {
    try {
        await dbConnect();
        // Ensure models are registered
        void Sku;
        void Client;
        void RXHQUsers;

        const { searchParams } = new URL(request.url);

        const salesRep = searchParams.get('salesRep');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // ─── Build Match Query ──────────────────────────────────────────
        const query: any = {
            orderStatus: 'Completed'
        };

        if (salesRep) {
            query.salesRep = { $in: salesRep.split(',') };
        }

        // Non-timezone based date filtering:
        // We use the YYYY-MM-DD strings and create Date objects at midnight UTC
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                // Start of day: YYYY-MM-DDT00:00:00.000Z
                query.createdAt.$gte = new Date(startDate + 'T00:00:00.000Z');
            }
            if (endDate) {
                // End of day: YYYY-MM-DDT23:59:59.999Z
                query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
            }
        }

        // ─── Aggregation Pipeline ───────────────────────────────────────
        const COMMISSION_RATE = 0.05; // 5%

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
                    }
                }
            },
            // Only include orders where subtotal > 0
            { $match: { _subtotal: { $gt: 0 } } },
            {
                $addFields: {
                    // Commission is always on subtotal
                    _commission: { $multiply: ['$_subtotal', COMMISSION_RATE] }
                }
            }
        ];

        // ─── Individual Orders (for table) ──────────────────────────────
        const ordersPipeline = [
            ...pipeline,
            { $sort: { createdAt: -1 as const } },
            { $limit: 5000 }, // Safety limit
            {
                $project: {
                    _id: 1,
                    label: 1,
                    clientId: 1,
                    salesRep: 1,
                    orderStatus: 1,
                    createdAt: 1,
                    lineItems: 1,
                    shippingCost: 1,
                    discount: 1,
                    tax: 1,
                    _subtotal: 1,
                    _grandTotal: 1,
                    _commission: 1
                }
            }
        ];

        // ─── Summary by Sales Rep ───────────────────────────────────────
        const summaryPipeline = [
            ...pipeline,
            {
                $group: {
                    _id: '$salesRep',
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$_subtotal' },
                    totalCommission: { $sum: '$_commission' },
                }
            },
            { $sort: { totalCommission: -1 as const } }
        ];

        // ─── Grand Totals ──────────────────────────────────────────────
        const grandTotalPipeline = [
            ...pipeline,
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$_subtotal' },
                    totalCommission: { $sum: '$_commission' },
                }
            }
        ];

        const [orders, repSummaries, grandTotals] = await Promise.all([
            SaleOrder.aggregate(ordersPipeline),
            SaleOrder.aggregate(summaryPipeline),
            SaleOrder.aggregate(grandTotalPipeline)
        ]);

        // Populate references
        const populatedOrders = await SaleOrder.populate(orders, [
            { path: 'clientId', select: 'name' },
            { path: 'salesRep', select: 'firstName lastName' },
            { path: 'lineItems.sku', select: 'name' }
        ]);

        // Populate sales rep names in summaries
        const populatedSummaries = await SaleOrder.populate(repSummaries, [
            { path: '_id', model: 'RXHQUsers', select: 'firstName lastName' }
        ]);

        const grandTotal = grandTotals[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            totalCommission: 0
        };
        delete grandTotal._id;

        return NextResponse.json({
            orders: populatedOrders,
            repSummaries: populatedSummaries,
            grandTotal,
            commissionRate: COMMISSION_RATE
        });
    } catch (error: any) {
        console.error('Commission report error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
