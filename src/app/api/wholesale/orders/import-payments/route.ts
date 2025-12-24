import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log('[import-payments] API called');
    try {
        await connectToDatabase();
        const body = await req.json();
        console.log('[import-payments] Received', body.data?.length || 0, 'rows');
        const { data } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid data format. Expected array of items.' }, { status: 400 });
        }

        if (data.length === 0) {
            return NextResponse.json({ message: 'No data to import', count: 0 });
        }

        // Debug: Log first row to see actual headers
        if (data.length > 0) {
            console.log('[import-payments] First row keys:', Object.keys(data[0]));
            console.log('[import-payments] First row sample:', JSON.stringify(data[0]));
        }

        // Normalize keys helper
        const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Helper to parse currency values (strip $ and commas)
        const parseCurrency = (val: any): number => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            // Remove $, commas, spaces, and any other non-numeric chars except . and -
            const cleaned = String(val).replace(/[$,\s]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        };

        // Pre-process all rows and group by order
        const paymentsByOrder = new Map<string, any[]>();
        const orderRefs = new Set<string>();

        for (const rawItem of data) {
            // Also store original keys for direct access
            const item: any = {};
            Object.keys(rawItem).forEach(k => {
                item[normalizeKey(k)] = rawItem[k];
            });

            const _id = item._id || item.id || rawItem._id || rawItem.id;
            
            // Try multiple possible order number field names (check both normalized and original)
            const orderNumber = item.ordernumber || item.orderid || item.order || item.label || 
                               rawItem.orderNumber || rawItem.OrderNumber || rawItem['Order Number'];
            
            // Try multiple possible payment amount field names (check both normalized and original)
            const rawPaymentAmount = item.paymentamount || item.payment || item.amount || item.total || item.value || item.paid ||
                                    rawItem.paymentAmount || rawItem.PaymentAmount || rawItem['Payment Amount'] || rawItem.Amount;
            
            const createdAt = item.createdat || item.date || item.paymentdate ||
                             rawItem.createdAt || rawItem.CreatedAt || rawItem.Date;
            const createdBy = item.createdby || item.user || item.salesrep || item.paidby ||
                             rawItem.createdBy || rawItem.CreatedBy;

            // Debug first item
            if (orderRefs.size === 0) {
                console.log('[import-payments] Parsed first row - orderNumber:', orderNumber, 'rawPaymentAmount:', rawPaymentAmount, 'parsed:', parseCurrency(rawPaymentAmount));
            }

            if (!orderNumber) continue;

            const orderKey = String(orderNumber).trim();
            orderRefs.add(orderKey);

            if (!paymentsByOrder.has(orderKey)) {
                paymentsByOrder.set(orderKey, []);
            }

            const parsedAmount = parseCurrency(rawPaymentAmount);

            paymentsByOrder.get(orderKey)!.push({
                _id: _id || new mongoose.Types.ObjectId().toString(),
                orderNumber: orderKey,
                paymentAmount: parsedAmount,
                createdAt: createdAt ? new Date(createdAt) : new Date(),
                createdBy: createdBy || null
            });
        }

        console.log('[import-payments] Found', orderRefs.size, 'unique orders');

        if (orderRefs.size === 0) {
            return NextResponse.json({ message: 'No valid order references found', count: 0 });
        }

        // Fetch all orders in ONE query
        const orders = await SaleOrder.find({
            $or: [
                { label: { $in: Array.from(orderRefs) } },
                { _id: { $in: Array.from(orderRefs) } }
            ]
        });

        console.log('[import-payments] Found', orders.length, 'matching orders in DB');

        // Build bulk operations
        const bulkOps = [];
        let count = 0;

        for (const order of orders) {
            // Get payments for this order (check both label and _id)
            const newPayments = [
                ...(paymentsByOrder.get(order.label) || []),
                ...(paymentsByOrder.get(order._id.toString()) || [])
            ];

            if (newPayments.length === 0) continue;

            // Merge with existing payments
            const existingPayments = order.payments || [];
            const existingIds = new Set(existingPayments.map((p: any) => p._id?.toString()));

            for (const payment of newPayments) {
                if (existingIds.has(payment._id)) {
                    // Update existing
                    const idx = existingPayments.findIndex((p: any) => p._id?.toString() === payment._id);
                    if (idx > -1) existingPayments[idx] = payment;
                } else {
                    // Add new
                    existingPayments.push(payment);
                }
                count++;
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: order._id },
                    update: { $set: { payments: existingPayments } }
                }
            });
        }

        if (bulkOps.length > 0) {
            console.log('[import-payments] Executing', bulkOps.length, 'bulk operations');
            await SaleOrder.bulkWrite(bulkOps);
        }

        console.log('[import-payments] Successfully processed', count, 'payments');
        return NextResponse.json({ 
            message: 'Import completed', 
            count: count
        });

    } catch (error: any) {
        console.error('[import-payments] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
