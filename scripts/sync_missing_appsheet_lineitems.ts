import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import dbConnect from '../src/lib/mongoose';
import SaleOrder from '../src/models/SaleOrder';
import Sku from '../src/models/Sku';
import Client from '../src/models/Client';
import RXHQUsers from '../src/models/User';
import { syncOrderLineItemToAppSheet } from '../src/lib/appsheet';

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
        console.log(`Syncing missing line items for order ${order.label} (ID: ${order._id})...`);
        try {
            if (order.lineItems && order.lineItems.length > 0) {
                console.log(`Syncing ${order.lineItems.length} line items...`);
                for (let i = 0; i < order.lineItems.length; i++) {
                    const item = order.lineItems[i];
                    console.log(`  -> Syncing Line Item ${i+1}/${order.lineItems.length}: SKU ${item.sku ? (item.sku.name || item.sku) : 'Unknown'} - Qty: ${item.qtyShipped}`);
                    
                    // We'll pass 'Add' and rely on the internal retry with 'Edit' inside `syncOrderLineItemToAppSheet` if it finds a duplicate key.
                    // Wait 1 second between adds to avoid rate limit/timeout.
                    const result = await syncOrderLineItemToAppSheet(order, item, 'Add');
                    console.log(`    Result: ${result ? 'Success' : 'Failed or timed out'}`);
                    
                    // Sleep 1 second
                    await new Promise(r => setTimeout(r, 1000));
                }
            } else {
                console.log(`No line items found for order ${order.label}.`);
            }
        } catch (e) {
            console.error(`Failed to sync line items for order ${order.label}`, e);
        }
    }

    console.log("\n===========================================");
    console.log("Done syncing missing line items.");
    process.exit(0);
}

main().catch(console.error);
