import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
        }

        const db = mongoose.connection.db;

        // Build SKU lookup map (legacyId -> _id)
        const skuMap = new Map<string, string>();
        if (db) {
            const allSkus = await db.collection('skus').find(
                {},
                { projection: { _id: 1, legacyId: 1, name: 1 } }
            ).toArray();
            allSkus.forEach((s: any) => {
                if (s.legacyId) skuMap.set(String(s.legacyId), s._id.toString());
                skuMap.set(s._id.toString(), s._id.toString());
            });
        }

        // Build Recipe lookup map (legacyId -> _id)
        const recipeMap = new Map<string, string>();
        if (db) {
            const allRecipes = await db.collection('recipes').find(
                {},
                { projection: { _id: 1, legacyId: 1 } }
            ).toArray();
            allRecipes.forEach((r: any) => {
                if (r.legacyId) recipeMap.set(String(r.legacyId), r._id.toString());
                recipeMap.set(r._id.toString(), r._id.toString());
            });
        }

        let count = 0;
        const errors: string[] = [];

        const bulkOps: any[] = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const legacyId = row.legacyId || row._id || row.id || '';

                // Resolve SKU by legacyId
                const skuInput = String(row.sku || '').trim();
                const resolvedSku = skuMap.get(skuInput);
                if (!resolvedSku && skuInput) {
                    errors.push(`Row ${i + 1}: SKU '${skuInput}' not found`);
                }

                // Resolve Recipe by legacyId
                const recipeInput = String(row.recipesId || '').trim();
                const resolvedRecipe = recipeMap.get(recipeInput) || recipeInput || undefined;

                // Map createBy -> createdBy
                const createdBy = row.createdBy || row.createBy || '';

                // Transform notes from string to array of objects if needed
                let notes: any[] = [];
                if (typeof row.notes === 'string' && row.notes.trim()) {
                    notes = [{ note: row.notes, createdAt: new Date() }];
                }

                const doc: any = {
                    legacyId: legacyId ? String(legacyId) : undefined,
                    label: row.label || undefined,
                    sku: resolvedSku || skuInput,
                    recipesId: resolvedRecipe,
                    uom: row.uom || undefined,
                    qty: parseFloat(row.qty) || 0,
                    qtyDifference: row.qtyDifference !== undefined && row.qtyDifference !== '' ? parseFloat(row.qtyDifference) : undefined,
                    scheduledStart: row.scheduledStart ? new Date(row.scheduledStart) : undefined,
                    scheduledFinish: row.scheduledFinish ? new Date(row.scheduledFinish) : undefined,
                    priority: row.priority || 'Medium',
                    status: row.status || 'Draft',
                    createdBy,
                    finishedBy: row.finishedBy || undefined,
                    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
                    lineItems: [],
                    labor: []
                };

                if (notes.length > 0) {
                    doc.notes = notes;
                }

                if (legacyId) {
                    bulkOps.push({
                        updateOne: {
                            filter: { legacyId: String(legacyId) },
                            update: { $set: doc },
                            upsert: true
                        }
                    });
                } else {
                    bulkOps.push({
                        insertOne: { document: doc }
                    });
                }
            } catch (e: any) {
                errors.push(`Row ${i + 1}: ${e.message}`);
            }
        }

        if (bulkOps.length > 0) {
            try {
                const result = await Manufacturing.bulkWrite(bulkOps, { ordered: false });
                count = (result.insertedCount || 0) + (result.modifiedCount || 0) + (result.upsertedCount || 0);
            } catch (bulkError: any) {
                console.error('Manufacturing Bulk Write Error:', bulkError);
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
        console.error('Manufacturing Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
