import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Vendor from '@/models/Vendor';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const bulkOps = data.map((item: any) => {
            const processedItem = { ...item };

            // Map CSV headers to schema fields
            // _id, name, address, phone, email, contactName, payTerms, carrierPreference are expected

            if (processedItem.payTerms) {
                processedItem.paymentTerms = processedItem.payTerms;
                delete processedItem.payTerms;
            }

            // Handle potentially different CSV header names as fallback
            if (processedItem['Company Name'] && !processedItem.name) processedItem.name = processedItem['Company Name'];
            if (processedItem['Contact Name'] && !processedItem.contactName) processedItem.contactName = processedItem['Contact Name'];

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

        const result = await Vendor.bulkWrite(bulkOps as any);

        return NextResponse.json({
            message: 'Import completed',
            count: result.upsertedCount + result.modifiedCount + result.insertedCount
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
