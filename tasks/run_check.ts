import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        const db = mongoose.connection.db;
        
        if (!db) return;

        const countWebOrders = await db.collection('weborders').countDocuments();
        const countWebOrdersShopify = await db.collection('weborders').countDocuments({ platform: 'shopify', website: 'GRHKTATOM' });
        
        const countBkup = await db.collection('webordersBkup').countDocuments();
        const countBkupShopify = await db.collection('webordersBkup').countDocuments({ platform: 'shopify', website: 'GRHKTATOM' });
        
        console.log(`weborders total: ${countWebOrders}`);
        console.log(`weborders shopify + GRHKTATOM: ${countWebOrdersShopify}`);
        console.log(`webordersBkup total: ${countBkup}`);
        console.log(`webordersBkup shopify + GRHKTATOM: ${countBkupShopify}`);
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
