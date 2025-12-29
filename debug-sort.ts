import dbConnect from './src/lib/mongoose';
import Sku from './src/models/Sku';

async function check() {
    await dbConnect();
    const skus = await Sku.find({ _id: { $in: ['37773', '24739', '75372'] } }).select('_id name totalWebOrders').lean();
    console.log(JSON.stringify(skus, null, 2));
    
    const topSkus = await Sku.find({ isWebProduct: true })
        .sort({ totalWebOrders: -1 })
        .limit(10)
        .select('_id name totalWebOrders')
        .lean();
    console.log('Top 10 by totalWebOrders (in DB):');
    console.log(JSON.stringify(topSkus, null, 2));
    
    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
