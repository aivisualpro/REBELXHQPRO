import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import WebProduct from '@/models/WebProduct';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
    try {
        await dbConnect();

        // Fetch all web orders with line items
        const orders = await WebOrder.find({})
            .select('_id number webId website dateCreated status lineItems')
            .lean() as any[];

        if (!orders || orders.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Collect all unique linkedSkuIds and webProductIds for batch lookup
        const allLinkedSkuIds = new Set<string>();
        const allWebProductIds = new Set<string>();

        for (const order of orders) {
            if (!order.lineItems) continue;
            for (const item of order.lineItems) {
                if (item.linkedSkuId) allLinkedSkuIds.add(item.linkedSkuId);
                if (item.webProductId) allWebProductIds.add(item.webProductId);
                if (item.parentProductId) allWebProductIds.add(item.parentProductId);
            }
        }

        // Batch lookup SKUs
        const skuMap = new Map<string, any>();
        if (allLinkedSkuIds.size > 0) {
            const skus = await Sku.find({ _id: { $in: Array.from(allLinkedSkuIds) } })
                .select('name legacyId')
                .lean();
            for (const s of skus as any[]) {
                skuMap.set(s._id.toString(), s);
            }
        }

        // Batch lookup WebProducts for variation names
        const wpMap = new Map<string, any>();
        if (allWebProductIds.size > 0) {
            const webProducts = await WebProduct.find({ _id: { $in: Array.from(allWebProductIds) } })
                .select('variations')
                .lean();
            for (const wp of webProducts as any[]) {
                wpMap.set(wp._id.toString(), wp);
            }
        }

        // Build flat array of line items with order context
        const rows: any[] = [];

        for (const order of orders) {
            if (!order.lineItems || order.lineItems.length === 0) continue;

            for (const item of order.lineItems) {
                // Resolve SKU name
                const sku = item.linkedSkuId ? skuMap.get(item.linkedSkuId) : null;

                // Resolve variation name
                let variationName = '';
                const wpId = item.webProductId || item.parentProductId;
                if (wpId && item.variationId) {
                    const wp = wpMap.get(wpId.toString());
                    if (wp?.variations) {
                        const variation = wp.variations.find((v: any) =>
                            v.id == item.variationId || v._id == item.variationId
                        );
                        if (variation?.name) variationName = variation.name;
                    }
                }

                rows.push({
                    orderId: order._id,
                    orderNumber: order.number,
                    orderWebId: order.webId,
                    website: order.website,
                    orderStatus: order.status,
                    orderDate: order.dateCreated ? new Date(order.dateCreated).toISOString().split('T')[0] : '',
                    lineItemId: item.id || '',
                    lineItemMongoId: item._id?.toString() || '',
                    productName: item.name || '',
                    productId: item.productId || '',
                    variationId: item.variationId || '',
                    variationName,
                    skuCode: item.sku || '',
                    linkedSkuId: item.linkedSkuId || '',
                    linkedSkuName: sku?.name || '',
                    webProductId: item.webProductId || '',
                    lotNumber: item.lotNumber || '',
                    cost: item.cost || 0,
                    quantity: item.quantity || 0,
                    price: item.price || 0,
                    subtotal: item.subtotal || 0,
                    total: item.total || 0,
                });
            }
        }

        return NextResponse.json({ data: rows, total: rows.length });

    } catch (error: any) {
        console.error('Export line items error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
