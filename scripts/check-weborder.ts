import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WebOrderSchema = new mongoose.Schema({}, { strict: false });
const WebOrder = mongoose.models.WebOrder || mongoose.model('WebOrder', WebOrderSchema);

async function run() {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const order = await WebOrder.findOne({ _id: 'WC-GRHKTATOM-77997' }).lean();
    console.log("Order found:", !!order);
    if (order) {
        console.log("lineItems count:", order.lineItems?.length);
        const line = order.lineItems?.find((l: any) => l.id === 121553);
        console.log("lineItem found by id=121553:", !!line);
        if (line) {
            console.log("line item details:", JSON.stringify({
                id: line.id,
                _id: line._id,
                sku: line.sku,
                linkedSkuId: line.linkedSkuId,
                linkedSkus: line.linkedSkus
            }, null, 2));
        } else {
            console.log("available line ids:", order.lineItems?.map((l:any) => ({ id: l.id, _id: l._id })));
        }
    }
    process.exit(0);
}
run();
