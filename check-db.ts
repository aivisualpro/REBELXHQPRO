import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '.env.local') });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const db = mongoose.connection.db;
    if (!db) return;
    const obsStr = await db.collection('openingbalances').find({ sku: "6986986cf21918a2f3e29415" }).toArray();
    console.log("With String SKU:", JSON.stringify(obsStr, null, 2));
    const obsObj = await db.collection('openingbalances').find({ sku: new mongoose.Types.ObjectId("6986986cf21918a2f3e29415") }).toArray();
    console.log("With ObjectId SKU:", JSON.stringify(obsObj, null, 2));
    const all = await db.collection('openingbalances').find({ lotNumber: "07/11/25" }).toArray();
    console.log("All matching lotNumber:", JSON.stringify(all, null, 2));
    process.exit(0);
}
run();
