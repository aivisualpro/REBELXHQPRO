import dbConnect from './src/lib/mongoose';
import Sku from './src/models/Sku';
import WebOrder from './src/models/WebOrder';

async function migrate() {
    await dbConnect();
    console.log('Connected to MongoDB');

    // Reset all first
    await Sku.updateMany({ isWebProduct: true }, { totalWebOrders: 0 });
    console.log('Reset all SKU counts to 0');

    const statuses = ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'];

    // Aggregate by parentProductId
    const byParentId = await WebOrder.aggregate([
        { $match: { status: { $in: statuses } } },
        { $unwind: "$lineItems" },
        { $group: { 
            _id: "$lineItems.parentProductId", 
            orderIds: { $addToSet: "$_id" } 
        }},
        { $project: { _id: 1, count: { $size: "$orderIds" } }}
    ]);

    for (const item of byParentId) {
        if (item._id) {
            await Sku.findByIdAndUpdate(item._id, { totalWebOrders: item.count });
            console.log(`Updated SKU ID ${item._id} with ${item.count} orders`);
        }
    }

    // Aggregate by SKU string (fallback for items not linked by parentProductId)
    const bySku = await WebOrder.aggregate([
        { $match: { status: { $in: statuses } } },
        { $unwind: "$lineItems" },
        { $group: { 
            _id: "$lineItems.sku", 
            orderIds: { $addToSet: "$_id" } 
        }},
        { $project: { _id: 1, count: { $size: "$orderIds" } }}
    ]);

    for (const item of bySku) {
        if (item._id) {
            // Check if this SKU exists as an ID
            const skuDoc = await Sku.findById(item._id);
            if (skuDoc) {
                const newCount = Math.max(skuDoc.totalWebOrders || 0, item.count);
                if (newCount > (skuDoc.totalWebOrders || 0)) {
                    await Sku.findByIdAndUpdate(item._id, { totalWebOrders: newCount });
                    console.log(`Updated SKU ID ${item._id} via SKU string with ${newCount} orders`);
                }
            }
        }
    }

    process.exit(0);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
