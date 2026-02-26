import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';

export const maxDuration = 60;

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        if (!Array.isArray(data) || data.length === 0) {
            return NextResponse.json({ error: 'No data provided' }, { status: 400 });
        }

        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        // Group rows by orderId for efficient batch processing
        const orderMap = new Map<string, any[]>();
        for (const row of data) {
            const orderId = row.orderId;
            if (!orderId) {
                skipped++;
                continue;
            }
            if (!orderMap.has(orderId)) orderMap.set(orderId, []);
            orderMap.get(orderId)!.push(row);
        }

        // Process each order
        for (const [orderId, rows] of orderMap) {
            try {
                const order = await WebOrder.findById(orderId);
                if (!order) {
                    errors.push(`Order not found: ${orderId}`);
                    skipped += rows.length;
                    continue;
                }

                let orderModified = false;

                for (const row of rows) {
                    const lineItemId = row.lineItemId ? Number(row.lineItemId) : null;
                    const lineItemMongoId = row.lineItemMongoId || null;

                    if (!lineItemId && !lineItemMongoId) {
                        skipped++;
                        continue;
                    }

                    // Find the matching line item
                    const lineItem = (order.lineItems as any[]).find((li: any) => {
                        if (lineItemId && li.id === lineItemId) return true;
                        if (lineItemMongoId && li._id?.toString() === lineItemMongoId) return true;
                        return false;
                    });

                    if (!lineItem) {
                        errors.push(`Line item ${lineItemId || lineItemMongoId} not found in order ${orderId}`);
                        skipped++;
                        continue;
                    }

                    // Update fields if provided
                    if (row.lotNumber !== undefined && row.lotNumber !== '') {
                        lineItem.lotNumber = row.lotNumber;
                        orderModified = true;
                    } else if (row.lotNumber === '') {
                        lineItem.lotNumber = null;
                        orderModified = true;
                    }

                    if (row.cost !== undefined && row.cost !== '') {
                        lineItem.cost = parseFloat(row.cost) || 0;
                        orderModified = true;
                    }

                    if (row.linkedSkuId !== undefined && row.linkedSkuId !== '') {
                        lineItem.linkedSkuId = row.linkedSkuId;
                        orderModified = true;
                    }

                    updated++;
                }

                if (orderModified) {
                    await order.save();
                }

            } catch (err: any) {
                errors.push(`Error processing order ${orderId}: ${err.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            updated,
            skipped,
            total: data.length,
            errors: errors.length > 0 ? errors.slice(0, 50) : undefined,
            errorCount: errors.length
        });

    } catch (error: any) {
        console.error('Update line items import error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
