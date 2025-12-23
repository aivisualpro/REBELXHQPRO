import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body; // expect 'data' key for both imports

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Logic handled can be "upsert" based on _id if present in CSV
        const operations = data.map((item: any) => ({
            updateOne: {
                filter: { _id: item._id }, // Using user defined _id from CSV as unique key
                update: { $set: item },
                upsert: true
            }
        }));

        // Filter out items without _id if strictly required, but Schema allows auto-gen.
        // However, for bulk import usually ID is key. 
        // User said: "_id (will be used as mongodb id when import else auto generate)"
        // If csv has _id, us it. If not, insertOne might be better or generate one.
        // But bulkWrite with updateOne requires a filter. 
        // Let's assume if _id is missing, we create a new ID here or let mongo do it via insertOne?
        // Mixed operations are complex. Let's assume for main Import with ID, use ID.
        // If NO ID provided in CSV, we should probably use 'insertOne'.

        // Revised Strategy:
        const bulkOps = data.map((item: any) => {
            // Transform notes from string to array of objects if needed
            const processedItem = { ...item };
            if (typeof processedItem.notes === 'string' && processedItem.notes.trim()) {
                processedItem.notes = [{ note: processedItem.notes, createdAt: new Date() }];
            } else if (typeof processedItem.notes === 'string') {
                delete processedItem.notes; // Remove empty/invalid notes
            }

            // Map createBy -> createdBy if needed (handle CSV column name mismatch)
            if (processedItem.createBy && !processedItem.createdBy) {
                processedItem.createdBy = processedItem.createBy;
                delete processedItem.createBy;
            }

            if (processedItem._id) {
                return {
                    updateOne: {
                        filter: { _id: processedItem._id },
                        update: { $set: processedItem },
                        upsert: true
                    }
                };
            } else {
                return {
                    insertOne: {
                        document: processedItem
                    }
                };
            }
        });

        const result = await Manufacturing.bulkWrite(bulkOps as any);

        return NextResponse.json({ message: 'Import completed', count: result.upsertedCount + result.modifiedCount + result.insertedCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
