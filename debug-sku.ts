import dbConnect from './src/lib/mongoose';
import SaleOrder from './src/models/SaleOrder';
import WebOrder from './src/models/WebOrder';
import Manufacturing from './src/models/Manufacturing';

async function test() {
    await dbConnect();
    const skuId = "7OH3mgGummy";
    
    console.log("Checking SaleOrders for " + skuId);
    const sos = await SaleOrder.find({ 'lineItems.sku': skuId }).lean();
    console.log("Found " + sos.length + " SaleOrders");
    sos.forEach(so => console.log("SO ID: " + so._id + " Status: " + so.orderStatus));

    console.log("Checking WebOrders for " + skuId);
    const wos = await WebOrder.find({ 'lineItems.sku': skuId }).lean();
    console.log("Found " + wos.length + " WebOrders");
    wos.forEach(wo => console.log("WO ID: " + wo._id + " Status: " + wo.status));

    console.log("Checking Manufacturing Consumption for " + skuId);
    const mos = await Manufacturing.find({ 'lineItems.sku': skuId }).lean();
    console.log("Found " + mos.length + " Manufacturing Jobs (Consumed)");
    mos.forEach(mo => console.log("MO ID: " + mo._id + " Status: " + mo.status));

    process.exit(0);
}

test();
