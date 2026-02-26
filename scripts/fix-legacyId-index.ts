/**
 * Fix: Drop the non-sparse legacyId unique index on the clients collection
 * so that Mongoose can recreate it as a sparse unique index.
 *
 * This resolves the E11000 duplicate key error for legacyId: null when
 * creating new clients that don't have a legacyId.
 *
 * Usage: npx tsx scripts/fix-legacyId-index.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in .env.local');
    process.exit(1);
}

async function fixIndex() {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI!, { dbName: 'RebelXHQSystems' });
    console.log('✅ Connected!\n');

    const db = mongoose.connection.db!;
    const collection = db.collection('clients');

    // List current indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes on "clients" collection:');
    for (const idx of indexes) {
        console.log(`   - ${idx.name}  |  keys: ${JSON.stringify(idx.key)}  |  unique: ${idx.unique ?? false}  |  sparse: ${(idx as any).sparse ?? false}`);
    }

    // Check for the problematic index
    const legacyIdIndex = indexes.find(i => i.name === 'legacyId_1');
    if (!legacyIdIndex) {
        console.log('\n⚠️  No index named "legacyId_1" found. Nothing to fix.');
    } else if ((legacyIdIndex as any).sparse === true) {
        console.log('\n✅ The legacyId_1 index is already sparse. Nothing to fix.');
    } else {
        console.log(`\n🔧 Dropping non-sparse index "legacyId_1"...`);
        await collection.dropIndex('legacyId_1');
        console.log('✅ Dropped!\n');

        console.log('🔧 Recreating index as unique + sparse...');
        await collection.createIndex({ legacyId: 1 }, { unique: true, sparse: true });
        console.log('✅ Recreated legacyId_1 as unique + sparse!\n');

        // Verify
        const newIndexes = await collection.indexes();
        const fixed = newIndexes.find(i => i.name === 'legacyId_1');
        console.log(`📋 Verified index: unique=${fixed?.unique}, sparse=${(fixed as any)?.sparse}`);
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected. Done!');
}

fixIndex().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
