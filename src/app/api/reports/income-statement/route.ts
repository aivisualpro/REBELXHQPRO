
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import SaleOrder from '@/models/SaleOrder';
import PurchaseOrder from '@/models/PurchaseOrder';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await dbConnect();
        
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const source = searchParams.get('source') || 'total'; // 'web', 'wholesale', 'total'
        const salesRep = searchParams.get('salesRep');

        // Build date filters — timezone-safe using explicit UTC boundaries
        let webDateFilter: any = {};
        let defaultDateFilter: any = {};
        if (startDate && endDate && startDate !== 'all' && endDate !== 'all') {
            // Parse as plain dates without timezone offset
            // e.g. "2026-03-01" → midnight UTC on that day
            const start = new Date(startDate + 'T00:00:00.000Z');
            const end = new Date(endDate + 'T23:59:59.999Z');

            webDateFilter = {
                dateCreated: { $gte: start, $lte: end }
            };
            defaultDateFilter = {
                createdAt: { $gte: start, $lte: end }
            };
        }

        if (salesRep) {
            defaultDateFilter.salesRep = { $in: salesRep.split(',') };
        }

        // 1. REVENUE
        let webRevenue = 0;
        let webOrdersCount = 0;
        let webShipping = 0;
        let webTax = 0;
        let saleRevenue = 0;
        let salesCount = 0;
        let saleShipping = 0;
        let saleTax = 0;

        // Web Orders Revenue (skip if source is 'wholesale' or if filtering by sales rep)
        if (source !== 'wholesale' && !salesRep) {
            const webRevenueAgg = await WebOrder.aggregate([
                { $match: { 
                    status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing'] },
                    ...webDateFilter
                }},
                { $group: { 
                    _id: null, 
                    total: { $sum: '$total' }, 
                    shipping: { $sum: { $ifNull: ["$shippingTotal", 0] } },
                    tax: { $sum: { $ifNull: ["$totalTax", 0] } },
                    count: { $sum: 1 } 
                } }
            ]);
            webRevenue = webRevenueAgg[0]?.total || 0;
            webShipping = webRevenueAgg[0]?.shipping || 0;
            webTax = webRevenueAgg[0]?.tax || 0;
            webOrdersCount = webRevenueAgg[0]?.count || 0;
        }

        // Sales Orders (Manual/Wholesale) - skip if source is 'web'
        if (source !== 'web') {
            const saleRevenueAgg = await SaleOrder.aggregate([
                { $match: { orderStatus: { $ne: 'Cancelled' }, ...defaultDateFilter } },
                { $addFields: {
                    lineItemsTotal: { $sum: "$lineItems.total" },
                    shipping: { $ifNull: ["$shippingCost", 0] },
                    discountVal: { $ifNull: ["$discount", 0] }
                }},
                { $project: {
                    grandTotal: { $subtract: [{ $add: ["$lineItemsTotal", "$shipping"] }, "$discountVal"] },
                    shipping: 1,
                    tax: { $ifNull: ["$tax", 0] }
                }},
                { $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" }, 
                    shipping: { $sum: "$shipping" },
                    tax: { $sum: "$tax" },
                    count: { $sum: 1 } 
                } }
            ]);
            saleRevenue = saleRevenueAgg[0]?.total || 0;
            saleShipping = saleRevenueAgg[0]?.shipping || 0;
            saleTax = saleRevenueAgg[0]?.tax || 0;
            salesCount = saleRevenueAgg[0]?.count || 0;
        }

        const totalRevenue = webRevenue + saleRevenue;
        const totalShipping = webShipping + saleShipping;
        const totalTax = webTax + saleTax;

        // 2. COST OF GOODS SOLD (COGS)
        let cogs = 0;
        
        // Wholesale COGS
        if (source !== 'web') {
            const saleCogsAgg = await SaleOrder.aggregate([
                { $match: { orderStatus: { $ne: 'Cancelled' }, ...defaultDateFilter } },
                { $unwind: "$lineItems" },
                { $group: {
                    _id: null,
                    total: { $sum: { $multiply: [{ $ifNull: ["$lineItems.qtyShipped", 0] }, { $ifNull: ["$lineItems.cost", 0] }] } }
                }}
            ]);
            cogs += saleCogsAgg[0]?.total || 0;
        }

        // Web COGS
        if (source !== 'wholesale' && !salesRep) {
            const webCogsAgg = await WebOrder.aggregate([
                { $match: { 
                    status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing'] },
                    ...webDateFilter
                }},
                { $project: { lineItems: 1 } }
            ]);
            
            webCogsAgg.forEach(order => {
                order.lineItems?.forEach((item: any) => {
                    const qty = item.quantity || 0;
                    if (item.linkedSkus && item.linkedSkus.length > 0) {
                        item.linkedSkus.forEach((ls: any) => {
                            cogs += (qty * (ls.multiplier || 1)) * (ls.cost || 0);
                        });
                    } else if (item.cost) {
                        cogs += qty * item.cost;
                    }
                });
            });
        }

        // 3. GROSS PROFIT
        const grossProfit = totalRevenue - cogs;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        // 4. OPERATING EXPENSES (Mock for now - would come from expense model)
        const operatingExpenses = {
            salaries: 0,
            marketing: 0,
            utilities: 0,
            other: 0,
            total: 0
        };

        // 5. NET INCOME
        // Removing shipping and tax from net income as requested
        const netIncome = grossProfit - operatingExpenses.total - totalShipping - totalTax;
        const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

        // Monthly Revenue Trend
        // Build based on the source filter
        let monthlyRevenue: any[] = [];

        if (source !== 'wholesale' && !salesRep) {
            // Web Orders monthly
            const webMonthly = await WebOrder.aggregate([
                { $match: { 
                    status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing'] },
                    total: { $gt: 0 },
                    ...webDateFilter
                }},
                { $project: {
                    total: 1,
                    yearMonth: {
                        $cond: {
                            if: { $eq: [{ $type: "$dateCreated" }, "date"] },
                            then: { $dateToString: { format: "%Y-%m", date: "$dateCreated" } },
                            else: {
                                $cond: {
                                    if: { $eq: [{ $type: "$dateCreated" }, "string"] },
                                    then: { $substr: ["$dateCreated", 0, 7] },
                                    else: "Unknown"
                                }
                            }
                        }
                    }
                }},
                { $group: {
                    _id: "$yearMonth",
                    revenue: { $sum: "$total" },
                    orders: { $sum: 1 }
                }},
                { $match: { _id: { $ne: "Unknown" } } },
                { $sort: { _id: -1 } },
                { $limit: 12 }
            ]);
            monthlyRevenue = webMonthly;
        }

        if (source !== 'web') {
            // Wholesale monthly
            const saleMonthly = await SaleOrder.aggregate([
                { $match: { orderStatus: { $ne: 'Cancelled' }, ...defaultDateFilter } },
                { $addFields: {
                    lineItemsTotal: { $sum: "$lineItems.total" },
                    shipping: { $ifNull: ["$shippingCost", 0] },
                    discountVal: { $ifNull: ["$discount", 0] }
                }},
                { $project: {
                    grandTotal: { $subtract: [{ $add: ["$lineItemsTotal", "$shipping"] }, "$discountVal"] },
                    yearMonth: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
                }},
                { $group: {
                    _id: "$yearMonth",
                    revenue: { $sum: "$grandTotal" },
                    orders: { $sum: 1 }
                }},
                { $sort: { _id: -1 } },
                { $limit: 12 }
            ]);

            if (source === 'wholesale') {
                monthlyRevenue = saleMonthly;
            } else {
                // Merge web + wholesale monthly data for 'total' view
                const mergedMap = new Map<string, { revenue: number; orders: number }>();
                monthlyRevenue.forEach(m => {
                    mergedMap.set(m._id, { revenue: m.revenue, orders: m.orders });
                });
                saleMonthly.forEach((m: any) => {
                    const existing = mergedMap.get(m._id);
                    if (existing) {
                        existing.revenue += m.revenue;
                        existing.orders += m.orders;
                    } else {
                        mergedMap.set(m._id, { revenue: m.revenue, orders: m.orders });
                    }
                });
                monthlyRevenue = Array.from(mergedMap.entries())
                    .map(([_id, data]) => ({ _id, ...data }))
                    .sort((a, b) => a._id.localeCompare(b._id))
                    .slice(-12);
            }
        }

        // Sort oldest to newest
        monthlyRevenue.sort((a: any, b: any) => (a._id || '').localeCompare(b._id || ''));

        return NextResponse.json({
            revenue: {
                total: totalRevenue,
                web: webRevenue,
                wholesale: saleRevenue,
                webOrders: webOrdersCount,
                wholesaleOrders: salesCount
            },
            cogs,
            grossProfit,
            grossMargin,
            operatingExpenses,
            totalShipping,
            totalTax,
            netIncome,
            netMargin,
            monthlyRevenue
        });

    } catch (error: any) {
        console.error("Income Statement API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
