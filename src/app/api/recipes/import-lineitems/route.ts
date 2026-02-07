import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import { Recipe } from '@/models/Recipe';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
        }

        let count = 0;
        const errors: string[] = [];

        // Build SKU lookup map (legacyId -> _id) using raw driver
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

        // Build recipe lookup map (legacyId -> _id)
        const recipeMap = new Map<string, string>();
        if (db) {
            const allRecipes = await db.collection('recipes').find(
                {},
                { projection: { _id: 1, legacyId: 1, name: 1 } }
            ).toArray();
            allRecipes.forEach((r: any) => {
                if (r.legacyId) recipeMap.set(String(r.legacyId), r._id.toString());
                recipeMap.set(r._id.toString(), r._id.toString());
                if (r.name) recipeMap.set(r.name, r._id.toString());
            });
        }

        // Group rows by recipeId
        const groups = new Map<string, any[]>();
        for (const row of data) {
            const rRef = row.recipeId || '';
            if (!rRef) { errors.push(`Row missing recipeId (sku: ${row.sku})`); continue; }
            if (!groups.has(rRef)) groups.set(rRef, []);
            groups.get(rRef)!.push(row);
        }

        const operations: any[] = [];

        for (const [rRef, rows] of groups.entries()) {
            // Resolve recipe by legacyId first
            const recipeId = recipeMap.get(rRef);
            if (!recipeId) {
                errors.push(`Recipe not found for '${rRef}' (${rows.length} rows)`);
                continue;
            }

            const newItems: any[] = [];
            for (const row of rows) {
                try {
                    const skuInput = String(row.sku || '').trim();
                    if (!skuInput) throw new Error('SKU required');

                    // Resolve SKU by legacyId
                    const resolvedSku = skuMap.get(skuInput) || skuMap.get(skuInput.toLowerCase());
                    if (!resolvedSku) throw new Error(`SKU '${skuInput}' not found`);

                    const createdBy = row.createdBy || row.createBy || '';
                    const createdAt = row.createdAt || row.createAt;

                    newItems.push({
                        _id: new mongoose.Types.ObjectId(),
                        sku: resolvedSku,
                        qty: parseFloat(row.qty) || 0,
                        uom: row.uom || '',
                        createdBy,
                        createdAt: createdAt ? new Date(createdAt) : new Date()
                    });
                } catch (rowErr: any) {
                    errors.push(`Row error (sku: ${row.sku}): ${rowErr.message}`);
                }
            }

            if (newItems.length > 0) {
                operations.push({
                    updateOne: {
                        filter: { _id: new mongoose.Types.ObjectId(recipeId) },
                        update: { $push: { lineItems: { $each: newItems } } }
                    }
                });
            }
        }

        if (operations.length > 0) {
            try {
                await Recipe.bulkWrite(operations, { ordered: false });
                let queuedItems = 0;
                operations.forEach(op => queuedItems += op.updateOne.update.$push.lineItems.$each.length);
                count = queuedItems;
            } catch (bulkErr: any) {
                console.error('Bulk Write Error:', bulkErr);
                if (bulkErr.writeErrors) {
                    for (const we of bulkErr.writeErrors) {
                        errors.push(`Write error: ${we.errmsg}`);
                    }
                } else {
                    errors.push(`Bulk write failed: ${bulkErr.message}`);
                }
            }
        }

        return NextResponse.json({ count, errors });
    } catch (error: any) {
        console.error('Recipe Line Items Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
