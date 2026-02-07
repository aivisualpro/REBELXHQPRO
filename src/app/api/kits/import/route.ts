import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import { Kit } from '@/models/Kit';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
        }

        let count = 0;
        const errors: string[] = [];

        const validKits: any[] = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                if (!row.name) throw new Error('Name is required');

                const legacyId = row.legacyId || row._id || row.id || '';
                const createdBy = row.createdBy || row.createBy || '';
                const createdAt = row.createdAt || row.createAt;

                validKits.push({
                    legacyId: legacyId ? String(legacyId) : undefined,
                    name: row.name,
                    createdBy,
                    createdAt: createdAt ? new Date(createdAt) : new Date(),
                    lineItems: []
                });
            } catch (e: any) {
                errors.push(`Row ${i + 1} (${row.name || 'unknown'}): ${e.message}`);
            }
        }

        if (validKits.length > 0) {
            try {
                const operations = validKits.map(kit => {
                    if (kit.legacyId) {
                        return {
                            updateOne: {
                                filter: { legacyId: kit.legacyId },
                                update: { $set: kit },
                                upsert: true
                            }
                        };
                    } else {
                        return {
                            insertOne: { document: kit }
                        };
                    }
                });

                const result = await Kit.bulkWrite(operations, { ordered: false });
                count = (result.insertedCount || 0) + (result.modifiedCount || 0) + (result.upsertedCount || 0);
            } catch (bulkError: any) {
                console.error('Kit Bulk Write Error:', bulkError);
                if (bulkError.result) {
                    const res = bulkError.result;
                    count = (res.nInserted || 0) + (res.nModified || 0) + (res.nUpserted || 0);
                }
                if (bulkError.writeErrors) {
                    for (const we of bulkError.writeErrors) {
                        errors.push(`Write error: ${we.errmsg || we.message}`);
                    }
                } else {
                    errors.push(`Bulk write failed: ${bulkError.message}`);
                }
            }
        }

        return NextResponse.json({ count, errors });
    } catch (error: any) {
        console.error('Kit Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
