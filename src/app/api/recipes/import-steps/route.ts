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

        // Build recipe lookup map (legacyId -> _id) using raw driver
        const db = mongoose.connection.db;
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
            if (!rRef) { errors.push(`Row missing recipeId (step: ${row.step})`); continue; }
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

            const newSteps: any[] = [];
            for (const row of rows) {
                try {
                    const createdBy = row.createdBy || row.createBy || '';
                    const createdAt = row.createdAt || row.createAt;

                    newSteps.push({
                        _id: new mongoose.Types.ObjectId(),
                        step: row.step || '',
                        description: row.description || '',
                        details: row.details || '',
                        createdBy,
                        createdAt: createdAt ? new Date(createdAt) : new Date()
                    });
                } catch (rowErr: any) {
                    errors.push(`Row error (step: ${row.step}): ${rowErr.message}`);
                }
            }

            if (newSteps.length > 0) {
                operations.push({
                    updateOne: {
                        filter: { _id: new mongoose.Types.ObjectId(recipeId) },
                        update: { $push: { steps: { $each: newSteps } } }
                    }
                });
            }
        }

        if (operations.length > 0) {
            try {
                await Recipe.bulkWrite(operations, { ordered: false });
                let queuedItems = 0;
                operations.forEach(op => queuedItems += op.updateOne.update.$push.steps.$each.length);
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
        console.error('Recipe Steps Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
