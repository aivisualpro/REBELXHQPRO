import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const clientId = searchParams.get('clientId');
        const skuId = searchParams.get('skuId');

        if (!clientId || !skuId) {
            return NextResponse.json({ price: null, message: "Missing clientId or skuId" }, { status: 400 });
        }

        // Find the most recent sale order for this client where lockPrice is true AND it contains the specified SKU
        const order = await SaleOrder.findOne({
            clientId: new mongoose.Types.ObjectId(clientId),
            lockPrice: true,
            'lineItems.sku': new mongoose.Types.ObjectId(skuId)
        })
            .sort({ createdAt: -1 })
            .select('lineItems');

        if (order && order.lineItems && order.lineItems.length > 0) {
            // Find the specific line item
            const lineItem = order.lineItems.find((item: any) =>
                (item.sku?._id || item.sku)?.toString() === skuId
            );

            if (lineItem && typeof lineItem.price === 'number') {
                return NextResponse.json({ price: lineItem.price });
            }
        }

        return NextResponse.json({ price: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
