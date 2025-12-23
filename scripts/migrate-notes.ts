
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';

async function migrateNotes() {
    await dbConnect();
    console.log('Connected to DB');

    const clients = await Client.find({});
    console.log(`Found ${clients.length} clients`);

    for (const client of clients) {
        // If notes is a string (which it might be in the raw DB data even if Schema says array due to mixed types or old data),
        // or if it's an array but check logic carefully.
        // Mongoose might return 'notes' as empty array if it fails cast string to array.
        // We need to bypass mongoose schema typing strictly to check raw value or assume it's currently whatever mongoose thinks.
        // Actually, if Schema says array, Mongoose might try to cast string to array of chars? No.

        // Since we JUST changed the schema code, the data in DB is still string.
        // But Mongoose queries might return it strangely or error.
        // Safer to use updateMany with aggregation pipeline or just basic update logic if we can read it.

        // Let's try to get the raw document or use $set.
        // Actually, if we use `lean()`, we might see the string.
    }

    // Aggregation pipeline update to convert string note to array object
    // Only if notes is of type string.
    // MongoDB $type: "string"

    try {
        const result = await Client.collection.updateMany(
            { notes: { $type: "string" } },
            [
                {
                    $set: {
                        notes: [
                            {
                                note: "$notes",
                                createdBy: "System Migration",
                                createdAt: new Date()
                            }
                        ]
                    }
                }
            ]
        );
        console.log(`Migrated ${result.modifiedCount} clients.`);
    } catch (e) {
        console.error('Migration error:', e);
    }
    process.exit();
}

migrateNotes();
