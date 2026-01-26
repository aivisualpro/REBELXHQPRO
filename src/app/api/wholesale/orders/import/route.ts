import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Client from '@/models/Client';
import { syncOrderToAppSheet } from '@/lib/appsheet';

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
        const ordersToSync = [];

        for (const row of data) {
            const mongoId = row._id || row.id;
            const label = row.label || row.orderId || row['Order ID'];
            
            if (!mongoId && !label) continue;

            const clientNameOrId = row.clientId || row.client || row['Client Name'];
            let clientId = null;

            if (clientNameOrId) {
                const exactClient = clients.find(c => c._id === clientNameOrId);
                if (exactClient) {
                    clientId = exactClient._id;
                } else {
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
            if (mongoId) updateData._id = mongoId;

            let filter = {};
            if (mongoId) {
                filter = { _id: mongoId };
            } else {
                filter = { label: label };
            }

            const updatedOrder = await SaleOrder.findOneAndUpdate(
                filter,
                { $set: updateData },
                { upsert: true, new: true, lean: true }
            );

            if (updatedOrder) {
                ordersToSync.push(updatedOrder);
            }
            count++;
        }

        // Sync to AppSheet (processing limited batch to avoid timeout)
        if (ordersToSync.length > 0) {
            // We'll sync them sequentially or in small batches
            for (const order of ordersToSync) {
                try {
                    // Refetch with population for proper sync names
                    const populated = await SaleOrder.findById(order._id)
                        .populate('clientId', 'name')
                        .populate('salesRep', 'firstName lastName')
                        .populate('lineItems.sku', 'name');
                    
                    if (populated) await syncOrderToAppSheet(populated);
                } catch (e) {
                    console.error('Error syncing order during import:', e);
                }
            }
        }

        return NextResponse.json({ success: true, count });
    } catch (error: any) {
        console.error('Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
