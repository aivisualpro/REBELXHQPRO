import dbConnect from '../src/lib/mongoose';
import Client from '../src/models/Client';
import SaleOrder from '../src/models/SaleOrder';
import Activity from '../src/models/Activity';
import RetentionTask from '../src/models/RetentionTask';
import mongoose from 'mongoose';

async function migrate() {
    console.log('Starting migration of client references...');
    await dbConnect();

    // 1. Get all clients to build a map of legacyId -> ObjectId
    const clients = await Client.find({}, '_id legacyId').lean();
    const idMap = new Map();
    clients.forEach((c: any) => {
        if (c.legacyId) {
            idMap.set(c.legacyId, c._id);
        }
    });

    console.log(`Mapping found for ${idMap.size} clients.`);

    // 2. Update SaleOrders
    console.log('Migrating SaleOrders...');
    const saleOrders = await SaleOrder.find({ clientId: { $type: 'string' } });
    let soCount = 0;
    for (const order of saleOrders) {
        const newId = idMap.get(order.clientId);
        if (newId) {
            order.clientId = newId;
            // Since we might change the type, we should be careful. 
            // In the model it is still String. We should update the models to use ObjectId type.
            await order.save();
            soCount++;
        }
    }
    console.log(`Updated ${soCount} SaleOrders.`);

    // 3. Update Activities
    console.log('Migrating Activities...');
    const activities = await Activity.find({ client: { $type: 'string' } });
    let actCount = 0;
    for (const act of activities) {
        const newId = idMap.get(act.client);
        if (newId) {
            act.client = newId;
            await act.save();
            actCount++;
        }
    }
    console.log(`Updated ${actCount} Activities.`);

    // 4. Update RetentionTasks
    console.log('Migrating RetentionTasks...');
    const tasks = await RetentionTask.find({ client: { $type: 'string' } });
    let taskCount = 0;
    for (const task of tasks) {
        const newId = idMap.get(task.client);
        if (newId) {
            task.client = newId;
            await task.save();
            taskCount++;
        }
    }
    console.log(`Updated ${taskCount} RetentionTasks.`);

    console.log('Migration complete!');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
