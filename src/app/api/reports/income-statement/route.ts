
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

        // Build date filter
        let dateFilter: any = {};
        if (startDate && endDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        // 1. REVENUE
        // Web Orders Revenue
        const webRevenueAgg = await WebOrder.aggregate([
            { $match: { 
                status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing'] },
                ...dateFilter
            }},
            { $group: { _id: null, total: { $sum: '$orderAmount' }, count: { $sum: 1 } } }
        ]);
        const webRevenue = webRevenueAgg[0]?.total || 0;
        const webOrdersCount = webRevenueAgg[0]?.count || 0;

        // Sales Orders (Manual/Wholesale)
        // Sales Orders (Manual/Wholesale) - Calculate Grand Total (Subtotal + Shipping - Discount)
        const saleRevenueAgg = await SaleOrder.aggregate([
            { $match: { orderStatus: { $ne: 'Cancelled' }, ...dateFilter } },
            // Add fields to calculate total per order first
            { $addFields: {
                lineItemsTotal: { $sum: "$lineItems.total" },
                shipping: { $ifNull: ["$shippingCost", 0] },
                discountVal: { $ifNull: ["$discount", 0] }
            }},
            // Calculate adjustments
            { $project: {
                grandTotal: { $subtract: [{ $add: ["$lineItemsTotal", "$shipping"] }, "$discountVal"] }
            }},
            { $group: { _id: null, total: { $sum: "$grandTotal" }, count: { $sum: 1 } } }
        ]);
        const saleRevenue = saleRevenueAgg[0]?.total || 0;
        const salesCount = saleRevenueAgg[0]?.count || 0;

        const totalRevenue = webRevenue + saleRevenue;

        // 2. COST OF GOODS SOLD (COGS)
        // For simplicity, we'll use purchase order costs as a proxy
        const cogsAgg = await PurchaseOrder.aggregate([
            { $match: dateFilter },
            { $unwind: "$lineItems" },
            { $group: { _id: null, total: { $sum: { $multiply: ["$lineItems.qtyReceived", "$lineItems.cost"] } } } }
        ]);
        const cogs = cogsAgg[0]?.total || 0;

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
        const netIncome = grossProfit - operatingExpenses.total;
        const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

        // Revenue Breakdown by Month (for charts) - simplified aggregation
        // First try to get by createdAt, fallback to getting order amounts grouped
        const monthlyRevenue = await WebOrder.aggregate([
            { $match: { 
                status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing'] },
                orderAmount: { $gt: 0 } // Only orders with revenue
            }},
            { $project: {
                orderAmount: 1,
                // Try to parse the date in multiple formats
                yearMonth: {
                    $cond: {
                        if: { $eq: [{ $type: "$createdAt" }, "date"] },
                        then: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                        else: {
                            $cond: {
                                if: { $eq: [{ $type: "$createdAt" }, "string"] },
                                then: { $substr: ["$createdAt", 0, 7] }, // Take first 7 chars (YYYY-MM)
                                else: "Unknown"
                            }
                        }
                    }
                }
            }},
            { $group: {
                _id: "$yearMonth",
                revenue: { $sum: "$orderAmount" },
                orders: { $sum: 1 }
            }},
            { $match: { _id: { $ne: "Unknown" } } }, // Filter out unknowns
            { $sort: { _id: -1 } }, // Sort descending to get latest months
            { $limit: 12 }
        ]);

        // Reverse to show oldest to newest
        monthlyRevenue.reverse();

        console.log("Monthly Revenue Data:", JSON.stringify(monthlyRevenue, null, 2));

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
            netIncome,
            netMargin,
            monthlyRevenue
        });

    } catch (error: any) {
        console.error("Income Statement API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
