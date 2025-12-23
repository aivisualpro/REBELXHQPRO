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
            .map((item: any) => ({
                updateOne: {
                    filter: { _id: item.clientid },
                    update: {
                        $push: {
                            notes: {
                                note: item.note,
                                createdBy: item.createdBy || 'Import',
                                createdAt: item.createdAt || new Date()
                            }
                        }
                    }
                }
            }));

        let updatedCount = 0;
        if (operations.length > 0) {
            const result = await Client.bulkWrite(operations as any);
            updatedCount = result.modifiedCount;
        }

        return NextResponse.json({ message: 'Import completed', updatedCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
