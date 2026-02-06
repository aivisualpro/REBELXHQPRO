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

        for (const row of data) {
            // Generate or use legacyId (same pattern as clients) - check many possible column names
            const legacyId = row.legacyId || row.LegacyId || row.legacy_id || 
                            row._id || row.Id || row.ID ||
                            row.orderId || row.OrderId || row.order_id || row['Order ID'] || row['Order Id'] ||
                            row.label || row.Label || row['Order Number'] || row.orderNumber;
            
            if (!legacyId) {
                skippedCount++;
                continue;
            }

            const label = row.label || row.orderId || row['Order ID'] || legacyId;

            // Match client by legacyId first, then by name
            const clientRef = row.clientId || row.client || row['Client Name'] || row.clientLegacyId;
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
            
            const updateData: any = {
                legacyId, // Store the legacyId for future imports/updates
                label,
                salesRep: row.salesRep,
                discount: parseFloat(row.discount) || 0,
                paymentMethod: row.paymentMethod,
                orderStatus: row.orderStatus || 'Pending',
                shippedDate: row.shippedDate ? new Date(row.shippedDate) : undefined,
                shippingMethod: row.shippingMethod,
                trackingNumber: row.trackingNumber,
                shippingCost: parseFloat(row.shippingCost) || 0,
                tax: parseFloat(row.tax) || 0,
                category: row.category,
                shippingAddress: row.shippingAddress,
                city: row.city,
                state: row.state,
                lockPrice: row.lockPrice === 'true' || row.lockPrice === true,
            };
            
            if (row.createdAt) {
                updateData.createdAt = new Date(row.createdAt);
            }

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
