import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        const MONGODB_URI = process.env.MONGODB_URI as string;
        const MONGODB_DB = process.env.MONGODB_DB as string;
        
        await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
        console.log('Connected to accurate DB.');

        const db = mongoose.connection.db;
        if (!db) {
            console.error("DB connection not established.");
            return;
        }
        
        // 1. Create a full backup of collection "weborders" as "webordersBkup"
        console.log('Creating backup collection "webordersBkup"...');
        try {
            await db.collection('webordersBkup').drop();
            console.log('Dropped existing backup.');
        } catch (e) {
            // ignore if not exists
        }
        
        const pipeline = [{ $match: {} }, { $out: 'webordersBkup' }];
        await db.collection('weborders').aggregate(pipeline).toArray();
        console.log('Backup created successfully.');

        // Verify count
        const bkupCount = await db.collection('webordersBkup').countDocuments();
        console.log(`webordersBkup total docs: ${bkupCount}`);

        const beforeRemove = await db.collection('weborders').countDocuments({
            platform: 'shopify',
            website: 'GRHKTATOM'
        });
        console.log(`Found ${beforeRemove} shopify GRHKTATOM records to remove...`);

        // 2. Remove all data where platform="shopify" and website="GRHKTATOM"
        console.log('Removing shopify GRHKTATOM data from weborders...');
        const result = await db.collection('weborders').deleteMany({
            platform: 'shopify',
            website: 'GRHKTATOM'
        });
        
        console.log(`Removed ${result?.deletedCount} records.`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

run();
