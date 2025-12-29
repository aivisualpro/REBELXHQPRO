import dbConnect from './src/lib/mongoose';
import Sku from './src/models/Sku';
import WebOrder from './src/models/WebOrder';

async function test() {
    await dbConnect();
    const sku = await Sku.findById("7OH3mgGummy").lean();
    if (!sku) {
        console.log("SKU not found");
        process.exit(0);
    }
    console.log("SKU Name:", sku.name);
    console.log("SKU Variances:", JSON.stringify(sku.variances, null, 2));
    
    const vids = (sku.variances || []).map((v: any) => v._id);
    const wos = await WebOrder.find({ "lineItems.varianceId": { $in: vids } }).lean();
    console.log("Found " + wos.length + " Web Orders for variances");
    wos.forEach(wo => {
        console.log("WO ID: " + wo._id);
        wo.lineItems.forEach((li: any) => {
            if (vids.includes(li.varianceId)) {
                console.log(" - Line Item for variance: " + li.varianceId);
            }
        });
    });
    process.exit(0);
}

test();
