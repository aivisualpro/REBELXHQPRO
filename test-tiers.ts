import dbConnect from './src/lib/mongoose';
import Manufacturing from './src/models/Manufacturing';
import SaleOrder from './src/models/SaleOrder';
import WebOrder from './src/models/WebOrder';
import Sku from './src/models/Sku';

async function test() {
    await dbConnect();
    const skus = await Sku.find({}).limit(100).lean();
    console.log("Checking " + skus.length + " skus...");
    
    for (const sku of skus) {
        const id = sku._id.toString();
        const hasSo = await SaleOrder.exists({ 'lineItems.sku': id, orderStatus: { $in: ['Shipped', 'Completed'] } });
        const hasWo = await WebOrder.exists({ 'lineItems.sku': id, status: { $in: ['completed', 'shipped'] } });
        const hasCons = await Manufacturing.exists({ 'lineItems.sku': id, status: { $in: ['Pending', 'In Progress', 'Completed'] } });
        
        const hasSales = hasSo || hasWo;
        
        if (hasSales && hasCons) {
            console.log("Tier 2 found: " + sku.name + " (" + id + ")");
        } else if (!hasSales && hasCons) {
            console.log("Tier 3 found: " + sku.name + " (" + id + ")");
        }
    }
    process.exit(0);
}

test();
