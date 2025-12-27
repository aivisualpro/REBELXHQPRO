import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Client from '@/models/Client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        
        const { searchParams } = new URL(request.url);
        const skuId = searchParams.get('skuId');
        
        if (!skuId) {
            return NextResponse.json({ error: 'skuId is required' }, { status: 400 });
        }

        // Find all sale orders that have a line item with this SKU
        const orders = await SaleOrder.find({
            'lineItems.sku': skuId
        })
        .populate('clientId', 'clientName companyName email phone')
        .sort({ createdAt: -1 })
        .lean();

        // Extract and flatten line items that match the SKU
        const lineItems: any[] = [];
        
        for (const order of orders) {
            const matchingItems = (order.lineItems || []).filter(
                (item: any) => item.sku === skuId || item.sku?.toString() === skuId
            );
            
            for (const item of matchingItems) {
                lineItems.push({
                    _id: item._id,
                    orderId: order._id,
                    orderLabel: order.label,
                    orderStatus: order.orderStatus,
                    orderDate: order.createdAt,
                    client: order.clientId,
                    lotNumber: item.lotNumber,
                    qtyShipped: item.qtyShipped,
                    uom: item.uom,
                    cost: item.cost,
                    price: item.price,
                    total: item.total
                });
            }
        }

        return NextResponse.json({
            success: true,
            lineItems,
            totalOrders: orders.length,
            totalItems: lineItems.length
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
