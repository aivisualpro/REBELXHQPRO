import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import PurchaseOrder from '@/models/PurchaseOrder';

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

            // Map createBy -> createdBy if needed
            if (processedItem.createBy && !processedItem.createdBy) {
                processedItem.createdBy = processedItem.createBy;
                delete processedItem.createBy;
            }

            // Map createAt -> createdAt if needed
            if (processedItem.createAt && !processedItem.createdAt) {
                processedItem.createdAt = new Date(processedItem.createAt);
                delete processedItem.createAt;
            }

            // Parse dates
            if (processedItem.scheduledDelivery) {
                processedItem.scheduledDelivery = new Date(processedItem.scheduledDelivery);
            }
            if (processedItem.receivedDate) {
                processedItem.receivedDate = new Date(processedItem.receivedDate);
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

        const result = await PurchaseOrder.bulkWrite(bulkOps as any);

        return NextResponse.json({
            message: 'Import completed',
            count: result.upsertedCount + result.modifiedCount + result.insertedCount
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
