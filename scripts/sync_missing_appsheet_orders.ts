import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import dbConnect from '../src/lib/mongoose';
import SaleOrder from '../src/models/SaleOrder';
import Sku from '../src/models/Sku';
import Client from '../src/models/Client';
import RXHQUsers from '../src/models/User';
import { syncOrderToAppSheet, syncPaymentToAppSheet } from '../src/lib/appsheet';

async function main() {
    await dbConnect();
    console.log("Connected to DB");

    const labels = Array.from({ length: 53324 - 53306 + 1 }, (_, i) => String(53306 + i));
    
    // Register models
    void Sku;
    void Client;
    void RXHQUsers;

    console.log(`Looking for labels: `, labels);

    const orders = await SaleOrder.find({ label: { $in: labels } })
        .populate('clientId', 'name legacyId')
        .populate('salesRep', 'firstName lastName email')
        .populate('lineItems.sku', 'name legacyId')
        .exec();

    console.log(`Found ${orders.length} orders matching the labels.`);

    for (const order of orders) {
        console.log(`\n===========================================`);
        console.log(`Syncing order ${order.label} (ID: ${order._id})...`);
        try {
            const result = await syncOrderToAppSheet(order);
            console.log(`Synced order ${order.label} and its line items. Result:`, result);

            if (order.payments && order.payments.length > 0) {
                console.log(`Syncing ${order.payments.length} payments for order ${order.label}...`);
                for (const payment of order.payments) {
                    const payResult = await syncPaymentToAppSheet(order, payment, 'Add');
                    console.log(`Synced payment ID ${payment._id} for order ${order.label}. Result:`, payResult);
                }
            } else {
                console.log(`No payments found for order ${order.label}.`);
            }
        } catch (e) {
            console.error(`Failed to sync order ${order.label}`, e);
        }
    }

    console.log("\n===========================================");
    console.log("Done syncing orders.");
    process.exit(0);
}

main().catch(console.error);
