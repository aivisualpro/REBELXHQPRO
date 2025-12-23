import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Ticket from '@/models/Ticket';
import mongoose from 'mongoose';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!data || !Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const operations = [];
        const errors: string[] = [];

        for (const [index, row] of data.entries()) {
            // Basic Validation
            if (!row.issue && !row.requestedBy) {
                // If strictly required, log error or skip. 
                // Let's assume we need at least issue or requestedBy to make sense.
                // errors.push(`Row ${index + 1}: Missing issue or requestedBy`);
            }

            const payload: any = {
                date: row.date ? new Date(row.date) : new Date(),
                requestedBy: row.requestedBy?.toString().trim(),
                subCategory: row.subCategory?.toString().trim(),
                issue: row.issue?.toString().trim(),
                reason: row.reason?.toString().trim(),
                priority: row.priority?.toString().trim() || 'Medium',
                description: row.description?.toString().trim(),
                department: row.department?.toString().trim(),
                document: row.document?.toString().trim(),
                status: row.status?.toString().trim() || 'Open',
                createdBy: row.createdBy?.toString().trim(),
                createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
                completionNote: row.completionNote?.toString().trim(),
                completedBy: row.completedBy?.toString().trim(),
                updatedAt: new Date()
            };

            if (row.deadline) payload.deadline = new Date(row.deadline);
            if (row.completedAt) payload.completedAt = new Date(row.completedAt);

            // If importing _id, use it for UPSERT
            if (row._id) {
                payload._id = row._id.toString();
                operations.push({
                    updateOne: {
                        filter: { _id: payload._id },
                        update: { $set: payload },
                        upsert: true
                    }
                });
            } else {
                // Insert New
                payload._id = new mongoose.Types.ObjectId().toString();
                operations.push({
                    insertOne: {
                        document: payload
                    }
                });
            }
        }

        let result: any = { insertedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        if (operations.length > 0) {
            result = await Ticket.bulkWrite(operations, { ordered: false });
            console.log('Import Tickets BulkWrite Result:', result);
        }

        return NextResponse.json({
            count: (result.insertedCount || 0) + (result.modifiedCount || 0) + (result.upsertedCount || 0),
            errors
        });

    } catch (e: any) {
        console.error("Import Tickets Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
