import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import { Recipe } from '@/models/Recipe';
import Sku from '@/models/Sku';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
        }

        let count = 0;
        const errors: string[] = [];

        // Build SKU lookup map (legacyId -> _id) using raw driver for cross-type safety
        const db = mongoose.connection.db;
        const skuMap = new Map<string, string>();
        if (db) {
            const allSkus = await db.collection('skus').find(
                {},
                { projection: { _id: 1, legacyId: 1, name: 1 } }
            ).toArray();
            allSkus.forEach((s: any) => {
                if (s.legacyId) skuMap.set(String(s.legacyId), s._id.toString());
                skuMap.set(s._id.toString(), s._id.toString());
                if (s.name) skuMap.set(s.name.toLowerCase(), s._id.toString());
            });
        }

        const validRecipes: any[] = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                // Normalize keys
                const createdBy = row.createdBy || row.createBy || '';
                const createdAt = row.createdAt || row.createAt;

                if (!row.name) throw new Error('Name is required');

                // Resolve SKU by legacyId first, then _id, then name
                const skuInput = String(row.sku || '').trim();
                if (!skuInput) throw new Error('SKU is required');
                const resolvedSku = skuMap.get(skuInput) || skuMap.get(skuInput.toLowerCase());
                if (!resolvedSku) throw new Error(`SKU '${skuInput}' not found`);

                // The CSV legacyId becomes the recipe's legacyId for future matching
                const legacyId = row.legacyId || row._id || row.id || '';

                validRecipes.push({
                    legacyId: legacyId ? String(legacyId) : undefined,
                    name: row.name,
                    sku: resolvedSku,
                    qty: parseFloat(row.qty) || 0,
                    uom: row.uom || '',
                    createdBy,
                    createdAt: createdAt ? new Date(createdAt) : new Date(),
                    lineItems: [],
                    steps: []
                });
            } catch (e: any) {
                errors.push(`Row ${i + 1} (${row.name || 'unknown'}): ${e.message}`);
            }
        }

        if (validRecipes.length > 0) {
            try {
                // Upsert by legacyId if available, otherwise insert
                const operations = validRecipes.map(recipe => {
                    if (recipe.legacyId) {
                        return {
                            updateOne: {
                                filter: { legacyId: recipe.legacyId },
                                update: { $set: recipe },
                                upsert: true
                            }
                        };
                    } else {
                        return {
                            insertOne: { document: recipe }
                        };
                    }
                });

                const result = await Recipe.bulkWrite(operations, { ordered: false });
                count = (result.insertedCount || 0) + (result.modifiedCount || 0) + (result.upsertedCount || 0);
            } catch (bulkError: any) {
                console.error('Recipe Bulk Write Error:', bulkError);
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
        console.error('Recipe Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
