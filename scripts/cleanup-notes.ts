
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';

async function cleanupNotes() {
    await dbConnect();
    console.log('Connected to DB for cleanup');

    // Pull notes where note field is empty string or null
    try {
        const result = await Client.updateMany(
            {},
            {
                $pull: {
                    notes: { note: { $in: ["", null] } }
                }
            }
        );
        console.log(`Cleaned up empty notes from ${result.modifiedCount} clients.`);
    } catch (e) {
        console.error('Cleanup error:', e);
    }
    process.exit();
}

cleanupNotes();
