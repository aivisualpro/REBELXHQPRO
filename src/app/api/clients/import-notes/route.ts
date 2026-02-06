import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { notes } = body; // Expecting { notes: [{ clientid, note, createdBy, createdAt }] }

        if (!Array.isArray(notes)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }


        const operations = notes
            .filter((item: any) => item.clientid && item.note)
            .map((item: any) => {
                // The source data seems to have swapped createdBy and createdAt, 
                // or specific fields like 'nick@grassrootsharvest.com' are in createdAt.
                // We'll try to be smart about it.
                let noteDate = new Date();
                let author = item.createdBy || 'Import';

                // If item.createdBy looks like a date and item.createdAt looks like an email
                if (item.createdAt && item.createdAt.includes('@')) {
                    author = item.createdAt;
                    if (item.createdBy && !isNaN(Date.parse(item.createdBy))) {
                        noteDate = new Date(item.createdBy);
                    }
                } else if (item.createdAt && !isNaN(Date.parse(item.createdAt))) {
                    noteDate = new Date(item.createdAt);
                    author = item.createdBy || 'Import';
                }

                return {
                    updateOne: {
                        filter: { legacyId: item.clientid },
                        update: {
                            $push: {
                                notes: {
                                    note: item.note,
                                    createdBy: author,
                                    createdAt: noteDate
                                }
                            }
                        }
                    }
                };
            });

        let updatedCount = 0;
        if (operations.length > 0) {
            // Use runValidators: false to ensure notes can be pushed even if other fields have minor validation issues
            const result = await Client.bulkWrite(operations as any, { ordered: false });
            updatedCount = result.modifiedCount;
            console.log(`Import Notes: Processed ${operations.length} notes, updated ${updatedCount} clients.`);
        }

        return NextResponse.json({ message: 'Import completed', updatedCount });
    } catch (error: any) {
        console.error("Import Notes Error Full:", error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
