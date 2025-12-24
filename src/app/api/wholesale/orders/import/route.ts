import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Client from '@/models/Client';

export const dynamic = 'force-dynamic';

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

        let count = 0;
        const clients = await Client.find({}).select('_id name').lean();

        for (const row of data) {
            // Mapping fields from CSV to Schema
            // Expected CSV (based on usage request): 
            // label/orderId, client, salesRep, discount, paymentMethod, orderStatus, shippedDate, shippingMethod, trackingNumber, shippingCost, tax, category, shippingAddress, city, state, lockPrice

            // Mapping fields from CSV to Schema
            // If row._id exists, it MUST be the mongodb _id.
            
            const mongoId = row._id || row.id;
            const label = row.label || row.orderId || row['Order ID']; // Label is semantic ID
            
            // We need at least one identifier
            if (!mongoId && !label) continue;

            const clientNameOrId = row.clientId || row.client || row['Client Name'];
            let clientId = null;

            if (clientNameOrId) {
                // Try to find by ID first
                const exactClient = clients.find(c => c._id === clientNameOrId);
                if (exactClient) {
                    clientId = exactClient._id;
                } else {
                    // Find by name (fuzzy or exact)
                     const foundClient = clients.find(c => 
                        c.name.toLowerCase() === clientNameOrId.toLowerCase() || 
                        c.name.toLowerCase().includes(clientNameOrId.toLowerCase())
                    );
                    if (foundClient) clientId = foundClient._id;
                }
            }
            
            const updateData: any = {
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

            if (label) updateData.label = label;
            if (clientId) updateData.clientId = clientId;
            if (mongoId) updateData._id = mongoId; // Explicitly set _id if provided

            // Determine search filter
            let filter = {};
            if (mongoId) {
                filter = { _id: mongoId };
            } else {
                filter = { label: label };
            }

            // Create or Update
            await SaleOrder.findOneAndUpdate(
                filter,
                { $set: updateData },
                { upsert: true, new: true }
            );
            count++;
        }

        return NextResponse.json({ success: true, count });
    } catch (error: any) {
        console.error('Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
