import 'dotenv/config'; // Load env vars if run standalone
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
}

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI!);
    console.log('Connected.\n');

    if (!mongoose.connection.db) {
        throw new Error("MongoDB connection not ready");
    }
    const db = mongoose.connection.db;

    const collections = [
        'openingbalances',
        'purchaseorders',
        'manufacturings',
        'auditadjustments',
        'saleorders',
        'weborders'
    ];

    for (const name of collections) {
        console.log(`--- Collection: ${name} ---`);
        try {
            const collection = db.collection(name);
            const count = await collection.countDocuments();
            console.log(`Size (Count): ${count}`);
            
            const indexes = await collection.indexes();
            console.log('Indexes:');
            indexes.forEach((idx: any) => {
                console.log(` - ${idx.name}: ${JSON.stringify(idx.key)}`);
            });
        } catch (e: any) {
            console.error(`Error inspecting ${name}:`, e.message);
        }
        console.log('');
    }

    await mongoose.disconnect();
    console.log('Disconnected.');
}

run();
