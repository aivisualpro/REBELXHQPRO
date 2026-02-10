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

        // Build a normalized key lookup helper for each row
        // This handles CSV headers like "Qty", "Qty Mfg.", "quantity", etc.
        const getVal = (row: any, ...keys: string[]): string | undefined => {
            // Direct match first
            for (const k of keys) {
                if (row[k] !== undefined && row[k] !== '') return String(row[k]);
            }
            // Case-insensitive fallback
            const rowKeys = Object.keys(row);
            for (const k of keys) {
                const lower = k.toLowerCase();
                const match = rowKeys.find(rk => rk.toLowerCase() === lower);
                if (match && row[match] !== undefined && row[match] !== '') return String(row[match]);
            }
            // Partial match fallback (starts with)
            for (const k of keys) {
                const lower = k.toLowerCase();
                const match = rowKeys.find(rk => rk.toLowerCase().startsWith(lower));
                if (match && row[match] !== undefined && row[match] !== '') return String(row[match]);
            }
            return undefined;
        };

        // Debug: log first row keys so we can see what the CSV headers are
        if (data.length > 0) {
            console.log('Manufacturing Import - CSV Headers:', Object.keys(data[0]));
            console.log('Manufacturing Import - First row:', JSON.stringify(data[0]));
        }

        const bulkOps: any[] = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const legacyId = getVal(row, 'legacyId', '_id', 'id') || '';

                // Resolve SKU by legacyId
                const skuInput = (getVal(row, 'sku', 'SKU') || '').trim();
                const resolvedSku = skuMap.get(skuInput);
                if (!resolvedSku && skuInput) {
                    errors.push(`Row ${i + 1}: SKU '${skuInput}' not found`);
                }

                // Resolve Recipe by legacyId
                const recipeInput = (getVal(row, 'recipesId', 'recipeId', 'recipe') || '').trim();
                const resolvedRecipe = recipeMap.get(recipeInput) || recipeInput || undefined;

                // Map createBy -> createdBy
                const createdBy = getVal(row, 'createdBy', 'createBy', 'Created By') || '';

                // Transform notes from string to array of objects if needed
                let notes: any[] = [];
                const rawNotes = getVal(row, 'notes', 'Notes');
                if (rawNotes && rawNotes.trim()) {
                    notes = [{ note: rawNotes, createdAt: new Date() }];
                }

                // Resolve qty with multiple header name fallbacks
                const rawQty = getVal(row, 'qty', 'Qty', 'Qty Mfg', 'Qty Mfg.', 'quantity', 'Quantity');
                const parsedQty = rawQty ? parseFloat(rawQty) : 0;

                // Resolve qtyDifference with fallbacks
                const rawQtyDiff = getVal(row, 'qtyDifference', 'Qty Difference', 'qtyDiff');

                const doc: any = {
                    legacyId: legacyId ? String(legacyId) : undefined,
                    label: getVal(row, 'label', 'Label', 'WO#', 'WO') || undefined,
                    sku: resolvedSku || skuInput,
                    recipesId: resolvedRecipe,
                    uom: getVal(row, 'uom', 'UOM', 'Unit') || undefined,
                    qty: isNaN(parsedQty) ? 0 : parsedQty,
                    qtyDifference: rawQtyDiff !== undefined ? parseFloat(rawQtyDiff) : undefined,
                    scheduledStart: getVal(row, 'scheduledStart', 'Scheduled Start') ? new Date(getVal(row, 'scheduledStart', 'Scheduled Start')!) : undefined,
                    scheduledFinish: getVal(row, 'scheduledFinish', 'Scheduled Finish') ? new Date(getVal(row, 'scheduledFinish', 'Scheduled Finish')!) : undefined,
                    priority: getVal(row, 'priority', 'Priority') || 'Medium',
                    status: getVal(row, 'status', 'Status') || 'Draft',
                    createdBy,
                    finishedBy: getVal(row, 'finishedBy', 'Finished By') || undefined,
                    createdAt: getVal(row, 'createdAt', 'Created At', 'createdDate') ? new Date(getVal(row, 'createdAt', 'Created At', 'createdDate')!) : new Date(),
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
