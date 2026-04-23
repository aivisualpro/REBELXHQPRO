const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { resolve } = require('path');

dotenv.config({ path: resolve(__dirname, '.env.local') });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    if (!db) return;
    const all = await db.collection('openingbalances').find({ lotNumber: "07/11/25" }).toArray();
    console.log("All matching lotNumber:", JSON.stringify(all, null, 2));
    process.exit(0);
}
run();
