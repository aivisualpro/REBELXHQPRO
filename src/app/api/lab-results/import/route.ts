import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import LabResult from '@/models/LabResult';
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
            // sanitize
            const name = row.name?.toString().trim();

            // Validation
            if (!name) {
                errors.push(`Row ${index + 1}: Missing name`);
                continue;
            }

            const payload: any = {
                name: name,
                variations: row.variations ? row.variations.toString().split(',').map((s: string) => s.trim()) : [],
                brand: row.brand?.toString().trim(),
                labTestStatus: row.labTestStatus?.toString().trim(),
                company: row.company?.toString().trim(),
                link: row.link?.toString().trim(),
                updatedAt: new Date()
            };

            if (row.labResultDate) payload.labResultDate = new Date(row.labResultDate);

            // If importing _id, use it for UPSERT
            if (row._id) {
                payload._id = row._id;
                operations.push({
                    updateOne: {
                        filter: { _id: row._id },
                        update: { $set: payload },
                        upsert: true
                    }
                });
            } else {
                // Insert New
                payload._id = new mongoose.Types.ObjectId().toString();
                payload.createdAt = new Date();
                operations.push({
                    insertOne: {
                        document: payload
                    }
                });
            }
        }

        let result: any = { insertedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        if (operations.length > 0) {
            result = await LabResult.bulkWrite(operations, { ordered: false });
            console.log('Import LabResults BulkWrite Result:', result);
        }

        return NextResponse.json({
            count: (result.insertedCount || 0) + (result.modifiedCount || 0) + (result.upsertedCount || 0),
            errors
        });

    } catch (e: any) {
        console.error("Import Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
