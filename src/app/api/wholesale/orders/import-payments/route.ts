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

            // orderNumber is the parent order reference (legacyId or label of the SaleOrder)
            // row.legacyId is the PAYMENT's own legacyId, NOT the parent order ref
            const orderNumber = item.ordernumber || item.orderid || item.order || item.label || 
                               rawItem.orderNumber || rawItem.OrderNumber || rawItem['Order Number'];
            
            // Payment's own legacyId for AppSheet sync
            const paymentLegacyId = rawItem.legacyId || rawItem.LegacyId || item.legacyid || '';
            
            // Try multiple possible payment amount field names (check both normalized and original)
            const rawPaymentAmount = item.paymentamount || item.payment || item.amount || item.total || item.value || item.paid ||
                                    rawItem.paymentAmount || rawItem.PaymentAmount || rawItem['Payment Amount'] || rawItem.Amount;
            
            const createdAt = item.createdat || item.date || item.paymentdate ||
                             rawItem.createdAt || rawItem.CreatedAt || rawItem.Date;
            const createdBy = item.createdby || item.user || item.salesrep || item.paidby ||
                             rawItem.createdBy || rawItem.CreatedBy;

            // Debug first item
            if (orderRefs.size === 0) {
                console.log('[import-payments] Parsed first row - orderNumber:', orderNumber, 'legacyId:', paymentLegacyId, 'rawPaymentAmount:', rawPaymentAmount, 'parsed:', parseCurrency(rawPaymentAmount));
            }

            if (!orderNumber) continue;

            const orderKey = String(orderNumber).trim();
            orderRefs.add(orderKey);

            if (!paymentsByOrder.has(orderKey)) {
                paymentsByOrder.set(orderKey, []);
            }

            const parsedAmount = parseCurrency(rawPaymentAmount);

            const paymentObj: any = {
                orderNumber: orderKey,
                paymentAmount: parsedAmount,
                createdAt: createdAt ? new Date(createdAt) : new Date(),
                createdBy: createdBy || null
            };

            // Only include legacyId if provided (not for UI-created payments)
            if (paymentLegacyId) {
                paymentObj.legacyId = paymentLegacyId;
            }

            paymentsByOrder.get(orderKey)!.push(paymentObj);
        }

        console.log('[import-payments] Found', orderRefs.size, 'unique orders');

        if (orderRefs.size === 0) {
            return NextResponse.json({ message: 'No valid order references found', count: 0 });
        }

        // Fetch all orders in ONE query (now also searches by legacyId)
        // Only include valid ObjectIds in the _id search to prevent CastError
        const allRefs = Array.from(orderRefs);
        const validObjectIds = allRefs.filter(id => mongoose.Types.ObjectId.isValid(id) && id.length === 24);
        
        const orConditions: any[] = [
            { label: { $in: allRefs } },
            { legacyId: { $in: allRefs } }
        ];
        if (validObjectIds.length > 0) {
            orConditions.push({ _id: { $in: validObjectIds } });
        }

        const orders = await SaleOrder.find({ $or: orConditions });

        console.log('[import-payments] Found', orders.length, 'matching orders in DB');

        // Build bulk operations
        const bulkOps: any[] = [];
        let count = 0;

        for (const order of orders) {
            // Get payments for this order (check label, _id, and legacyId)
            const matchingPayments = [
                ...(paymentsByOrder.get(order.label) || []),
                ...(paymentsByOrder.get(order._id.toString()) || []),
                ...(paymentsByOrder.get(order.legacyId) || [])
            ];

            if (matchingPayments.length === 0) continue;

            // Deduplicate (in case same ref matched multiple fields)
            const seenRows = new Set();
            const newPayments = matchingPayments.filter(p => {
                const key = JSON.stringify(p);
                if (seenRows.has(key)) return false;
                seenRows.add(key);
                return true;
            });

            // Merge with existing payments, dedup by legacyId
            const existingPayments = order.payments || [];
            const existingLegacyIds = new Set(
                existingPayments
                    .filter((p: any) => p.legacyId)
                    .map((p: any) => p.legacyId)
            );

            for (const payment of newPayments) {
                // Skip if this legacyId already exists (prevent duplicate import)
                if (payment.legacyId && existingLegacyIds.has(payment.legacyId)) {
                    continue;
                }
                existingPayments.push(payment);
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
            const session = await mongoose.startSession();
            await session.withTransaction(async () => {
                await SaleOrder.bulkWrite(bulkOps, { session });
            });
            await session.endSession();
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
