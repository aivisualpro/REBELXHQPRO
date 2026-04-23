import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    if (!db) return;
    const obs = await db.collection('openingbalances').find({ sku: "6986986cf21918a2f3e29415" }).toArray();
    console.log("With String SKU:", JSON.stringify(obs, null, 2));
    const obsObj = await db.collection('openingbalances').find({ sku: new mongoose.Types.ObjectId("6986986cf21918a2f3e29415") }).toArray();
    console.log("With ObjectId SKU:", JSON.stringify(obsObj, null, 2));
    process.exit(0);
}
run();
