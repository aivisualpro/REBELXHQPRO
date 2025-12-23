import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Helper to clean string values (handle #N/A and empty)
        const cleanStr = (val: any): string | undefined => {
            if (val === undefined || val === null || val === '' || val === '#N/A') return undefined;
            return String(val);
        };

        // Helper to parse date safely
        const parseDate = (val: any): Date => {
            if (!val || val === '#N/A' || val === '') return new Date();
            const parsed = new Date(val);
            return isNaN(parsed.getTime()) ? new Date() : parsed;
        };

        const operations = data
            .filter((item: any) => item.woNumber && item.woNumber !== '#N/A') // woNumber acts as reference to Parent Manufacturing Order
            .map((item: any) => ({
                updateOne: {
                    filter: { _id: item.woNumber },
                    update: {
                        $push: {
                            notes: {
                                _id: item._id || new mongoose.Types.ObjectId().toString(),
                                note: cleanStr(item.note),
                                createdBy: cleanStr(item.createBy || item.createdBy),
                                createdAt: parseDate(item.createdAt)
                            }
                        }
                    }
                }
            }));


        if (operations.length === 0) {
            return NextResponse.json({ message: 'No valid notes to import', count: 0 });
        }

        const result = await Manufacturing.bulkWrite(operations as any);

        return NextResponse.json({
            message: 'Notes import completed',
            count: result.modifiedCount
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
