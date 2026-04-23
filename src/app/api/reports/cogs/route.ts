import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import WebOrder from '@/models/WebOrder';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await dbConnect();
        
        // Ensure models are registered
        void Sku;

        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const source = searchParams.get('source') || 'total'; // 'web', 'wholesale', 'total'
        const salesRep = searchParams.get('salesRep');

        // Build date filters timezone-safely
        let defaultDateFilter: any = {};
        let webDateFilter: any = {};
        
        if (startDate && endDate && startDate !== 'all' && endDate !== 'all') {
            const start = new Date(startDate + 'T00:00:00.000Z');
            const end = new Date(endDate + 'T23:59:59.999Z');

            defaultDateFilter = {
                createdAt: { $gte: start, $lte: end }
            };
            webDateFilter = {
                dateCreated: { $gte: start, $lte: end }
            };
        }

        if (salesRep) {
            defaultDateFilter.salesRep = { $in: salesRep.split(',') };
        }

        let totalCogs = 0;
        let totalOrders = 0;
        let totalItems = 0;
        let totalRevenue = 0;

        let skuMap = new Map<string, { totalQty: number; totalCost: number; revenue: number }>();

        // 1. Process Wholesale (SaleOrder)
        if (source === 'wholesale' || source === 'total') {
            const soAgg = await SaleOrder.aggregate([
                { $match: { orderStatus: { $ne: 'Cancelled' }, ...defaultDateFilter } },
                { $project: {
                    createdAt: 1,
                    lineItems: 1,
                    total: 1
                }}
            ]);

            soAgg.forEach(order => {
                totalOrders++;
                let orderRevenue = 0;
                let orderCogs = 0;

                order.lineItems?.forEach((item: any) => {
                    const qty = item.qtyShipped || 0;
                    const cost = item.cost || 0;
                    const price = item.price || 0;
                    
                    const itemCost = qty * cost;
                    const itemRev = qty * price;

                    orderCogs += itemCost;
                    orderRevenue += itemRev;
                    totalItems += qty;

                    if (item.sku) {
                        const skuId = item.sku.toString();
                        const existing = skuMap.get(skuId) || { totalQty: 0, totalCost: 0, revenue: 0 };
                        existing.totalQty += qty;
                        existing.totalCost += itemCost;
                        existing.revenue += itemRev;
                        skuMap.set(skuId, existing);
                    }
                });

                totalCogs += orderCogs;
                totalRevenue += orderRevenue;
            });
        }

        // 2. Process Web Orders (WebOrder) - skip if salesRep is filtered (since web orders don't have sales reps)
        if ((source === 'web' || source === 'total') && !salesRep) {
            const woAgg = await WebOrder.aggregate([
                { $match: { 
                    status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing'] },
                    ...webDateFilter
                }},
                { $project: {
                    dateCreated: 1,
                    lineItems: 1,
                    total: 1
                }}
            ]);

            woAgg.forEach(order => {
                totalOrders++;
                let orderCogs = 0;
                let orderRevenue = order.total || 0; // use simple gross total for now

                order.lineItems?.forEach((item: any) => {
                    const qty = item.quantity || 0;
                    let itemCost = 0;
                    
                    // Web orders might use linkedSkus for true cost
                    if (item.linkedSkus && item.linkedSkus.length > 0) {
                        item.linkedSkus.forEach((ls: any) => {
                            const lsQty = qty * (ls.multiplier || 1);
                            const lsCost = ls.cost || 0;
                            const lsTotalCost = lsQty * lsCost;
                            itemCost += lsTotalCost;

                            if (ls.skuId) {
                                const skuId = ls.skuId.toString();
                                const existing = skuMap.get(skuId) || { totalQty: 0, totalCost: 0, revenue: 0 };
                                existing.totalQty += lsQty;
                                existing.totalCost += lsTotalCost;
                                skuMap.set(skuId, existing);
                            }
                        });
                    } else if (item.cost) {
                        itemCost = qty * item.cost;
                        // legacy single sku attachment
                        if (item.linkedSkuId) {
                            const skuId = item.linkedSkuId.toString();
                            const existing = skuMap.get(skuId) || { totalQty: 0, totalCost: 0, revenue: 0 };
                            existing.totalQty += qty;
                            existing.totalCost += itemCost;
                            skuMap.set(skuId, existing);
                        }
                    }

                    orderCogs += itemCost;
                    totalItems += qty;
                });

                totalCogs += orderCogs;
                totalRevenue += orderRevenue;
            });
        }

        // Post-process the SKUs to find Top SKUs and populate their details
        let topSkusArr = Array.from(skuMap.entries()).map(([skuId, data]) => ({
            skuId,
            ...data
        })).sort((a, b) => b.totalCost - a.totalCost).slice(0, 50);

        // Fetch Sku names
        const skuDocs = await Sku.find({ _id: { $in: topSkusArr.map(s => s.skuId).filter(id => id.length === 24) } }).select('name category').lean();
        const skuDbMap = new Map((skuDocs || []).map((s: any) => [s._id.toString(), s]));

        const topSkus = topSkusArr.map(s => {
            const dbSku: any = skuDbMap.get(s.skuId) || {};
            return {
                id: s.skuId,
                name: dbSku.name || 'Unknown SKU',
                category: dbSku.category || 'Uncategorized',
                totalQty: s.totalQty,
                totalCost: s.totalCost,
                revenue: s.revenue,
                margin: s.revenue > 0 ? ((s.revenue - s.totalCost) / s.revenue) * 100 : 0
            };
        });

        const summary = {
            totalCogs,
            totalOrders,
            totalItems,
            totalRevenue,
            avgCogsPerOrder: totalOrders > 0 ? (totalCogs / totalOrders) : 0,
            avgCostPerItem: totalItems > 0 ? (totalCogs / totalItems) : 0,
            blendedMargin: totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0 
        };

        return NextResponse.json({
            summary,
            topSkus
        });

    } catch (error: any) {
        console.error("COGS API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
