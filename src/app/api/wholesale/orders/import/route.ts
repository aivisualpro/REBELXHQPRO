import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Client from '@/models/Client';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
    console.log('[import-orders] API called');
    try {
        await dbConnect();
        const body = await request.json();
        console.log('[import-orders] Body keys:', Object.keys(body));
        const { data } = body;

        if (!data || !Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Debug: Log first row to see actual column names
        if (data.length > 0) {
            console.log('[import-orders] Total rows:', data.length);
            console.log('[import-orders] First row keys:', Object.keys(data[0]));
            console.log('[import-orders] First row sample:', JSON.stringify(data[0]).substring(0, 500));
        }

        // Use legacyId pattern - fetch clients by legacyId for matching
        const clients = await Client.find({}).select('_id legacyId name').lean();
        // Create a map for quick lookups by legacyId and name
        const clientByLegacyId = new Map(clients.map((c: any) => [c.legacyId, c._id]));
        const clientByName = new Map(clients.map((c: any) => [c.name?.toLowerCase(), c._id]));

        const operations: any[] = [];
        let skippedCount = 0;

        // Helper: resolve a field from a CSV row by checking multiple possible column names
        const resolveField = (row: any, ...keys: string[]): string | undefined => {
            for (const key of keys) {
                if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                    return String(row[key]).trim();
                }
            }
            return undefined;
        };

        // Helper: parse a numeric field, returns undefined if not present/empty
        // Strips currency symbols ($), commas, and whitespace before parsing
        const parseNum = (row: any, ...keys: string[]): number | undefined => {
            const val = resolveField(row, ...keys);
            if (val === undefined) return undefined;
            const cleaned = val.replace(/[$,\s]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? undefined : num;
        };

        for (const row of data) {
            // Generate or use legacyId (same pattern as clients) - check many possible column names
            const legacyId = resolveField(row,
                'legacyId', 'LegacyId', 'legacy_id', 'LegacyID',
                '_id', 'Id', 'ID', 'id',
                'orderId', 'OrderId', 'order_id', 'Order ID', 'Order Id',
                'label', 'Label', 'Order Number', 'orderNumber', 'OrderNumber', 'order_number'
            );

            if (!legacyId) {
                skippedCount++;
                continue;
            }

            const label = resolveField(row, 'label', 'Label', 'orderId', 'Order ID', 'Order Number', 'orderNumber') || legacyId;

            // Match client by legacyId first, then by name
            const clientRef = resolveField(row,
                'clientId', 'ClientId', 'client_id', 'Client ID',
                'client', 'Client', 'Client Name', 'clientName',
                'clientLegacyId', 'ClientLegacyId'
            );
            let clientId = null;

            if (clientRef) {
                // First try to match by legacyId
                if (clientByLegacyId.has(clientRef)) {
                    clientId = clientByLegacyId.get(clientRef);
                } else {
                    // Try by name (case-insensitive)
                    const lowerRef = String(clientRef).toLowerCase();
                    if (clientByName.has(lowerRef)) {
                        clientId = clientByName.get(lowerRef);
                    } else {
                        // Partial match
                        for (const [name, id] of clientByName) {
                            if (name && name.includes(lowerRef)) {
                                clientId = id;
                                break;
                            }
                        }
                    }
                }
            }

            // Build update data - only include fields that actually have values in the CSV
            // This prevents overwriting existing DB values with 0/empty when CSV column is missing
            const updateData: any = {
                legacyId,
                label,
            };

            // String fields - only set if present in CSV
            const salesRep = resolveField(row, 'salesRep', 'SalesRep', 'Sales Rep', 'sales_rep', 'SalesPerson', 'Sales Person');
            if (salesRep !== undefined) updateData.salesRep = salesRep;

            const paymentMethod = resolveField(row, 'paymentMethod', 'PaymentMethod', 'Payment Method', 'payment_method');
            if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;

            const orderStatus = resolveField(row, 'orderStatus', 'OrderStatus', 'Order Status', 'order_status', 'Status', 'status');
            if (orderStatus !== undefined) updateData.orderStatus = orderStatus;
            else if (!clientId) updateData.orderStatus = 'Pending'; // Default only for new records

            const shippingMethod = resolveField(row, 'shippingMethod', 'ShippingMethod', 'Shipping Method', 'shipping_method');
            if (shippingMethod !== undefined) updateData.shippingMethod = shippingMethod;

            const trackingNumber = resolveField(row, 'trackingNumber', 'TrackingNumber', 'Tracking Number', 'tracking_number', 'Tracking #', 'Tracking#');
            if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;

            const category = resolveField(row, 'category', 'Category');
            if (category !== undefined) updateData.category = category;

            const shippingAddress = resolveField(row, 'shippingAddress', 'ShippingAddress', 'Shipping Address', 'shipping_address', 'Address');
            if (shippingAddress !== undefined) updateData.shippingAddress = shippingAddress;

            const city = resolveField(row, 'city', 'City');
            if (city !== undefined) updateData.city = city;

            const state = resolveField(row, 'state', 'State');
            if (state !== undefined) updateData.state = state;

            // Numeric fields - only set if present and valid in CSV
            const shippingCost = parseNum(row, 'shippingCost', 'ShippingCost', 'Shipping Cost', 'shipping_cost', 'Shipping');
            if (shippingCost !== undefined) updateData.shippingCost = shippingCost;

            const discount = parseNum(row, 'discount', 'Discount');
            if (discount !== undefined) updateData.discount = discount;

            const tax = parseNum(row, 'tax', 'Tax');
            if (tax !== undefined) updateData.tax = tax;

            // Boolean field
            const lockPriceVal = resolveField(row, 'lockPrice', 'LockPrice', 'Lock Price', 'lock_price');
            if (lockPriceVal !== undefined) updateData.lockPrice = lockPriceVal === 'true' || lockPriceVal === 'TRUE' || lockPriceVal === '1';

            // Date fields
            const shippedDate = resolveField(row, 'shippedDate', 'ShippedDate', 'Shipped Date', 'shipped_date');
            if (shippedDate) updateData.shippedDate = new Date(shippedDate);

            const createdAt = resolveField(row, 'createdAt', 'CreatedAt', 'Created At', 'created_at', 'Date', 'Order Date', 'OrderDate');
            if (createdAt) updateData.createdAt = new Date(createdAt);

            if (clientId) {
                updateData.clientId = clientId;
            }

            // Use legacyId as the primary filter for upsert (same as clients)
            operations.push({
                updateOne: {
                    filter: { legacyId },
                    update: { $set: updateData },
                    upsert: true
                }
            });
        }

        // Bulk write for performance
        let count = 0;
        console.log(`[import-orders] Operations prepared: ${operations.length}, Skipped (no legacyId): ${skippedCount}`);

        if (operations.length > 0) {
            const result = await SaleOrder.bulkWrite(operations, { ordered: false });
            count = (result.upsertedCount || 0) + (result.modifiedCount || 0);
            console.log(`[import-orders] Bulk write completed: ${count} orders processed (${result.upsertedCount} inserted, ${result.modifiedCount} modified)`);
        }

        // Skip AppSheet sync during bulk import for performance
        // AppSheet sync can be triggered separately if needed

        return NextResponse.json({ success: true, count });
    } catch (error: any) {
        console.error('Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
