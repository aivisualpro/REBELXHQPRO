import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WebOrderSchema = new mongoose.Schema({}, { strict: false });
const WebOrder = mongoose.models.WebOrder || mongoose.model('WebOrder', WebOrderSchema);

async function run() {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const order = await WebOrder.findOne({ _id: '82401' }).lean() || await WebOrder.findOne({ number: '82401' }).lean();
    console.log("Order 82401 found:", !!order);
    if (order) {
        order.lineItems?.forEach((line: any) => {
            console.log("Line Item ID:", line.id);
            console.log("Line Item SKU string:", line.sku);
            console.log("Line Item linkedSkuId:", line.linkedSkuId);
            console.log("Line Item linkedSkus:", JSON.stringify(line.linkedSkus, null, 2));
            console.log("Line Item lotNumber:", line.lotNumber);
            console.log("Line Item dateCreated:", order.dateCreated);
        });
    }
    process.exit(0);
}
run();
