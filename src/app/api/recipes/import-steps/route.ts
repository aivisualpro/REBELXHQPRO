import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Recipe } from '@/models/Recipe';
import User from '@/models/User';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
        }

        let count = 0;
        const errors: string[] = [];

        // Caches
        const recipeCache = new Map<string, any>();

        // Lookup Helpers
        const findRecipeId = async (rId: string): Promise<string | null> => {
            if (!rId) return null;
            if (recipeCache.has(rId)) return recipeCache.get(rId);

            let recipe;
            if (rId.match(/^[0-9a-fA-F]{24}$/)) {
                recipe = await Recipe.findById(rId).select('_id').lean();
            }
            if (!recipe) {
                recipe = await Recipe.findOne({
                    $or: [
                        { _id: rId },
                        { name: rId }
                    ]
                }).select('_id').lean();
            }

            const id = recipe ? (recipe as any)._id : null;
            recipeCache.set(rId, id);
            return id;
        };

        // Group data by Recipe Reference
        const operations: any[] = [];
        const groups = new Map<string, any[]>();

        for (const row of data) {
            const rRef = row.recipeId;
            if (!groups.has(rRef)) groups.set(rRef, []);
            groups.get(rRef)?.push(row);
        }

        // Process each Group
        for (const [rRef, rows] of groups.entries()) {
            try {
                const recipeId = await findRecipeId(rRef);
                if (!recipeId) {
                    errors.push(`Recipe not found for '${rRef}' (referenced in ${rows.length} rows)`);
                    continue;
                }

                const newSteps: any[] = [];
                for (const row of rows) {
                    try {
                        const userId = row.createdBy || row.createBy;

                        const newStep: any = {
                            step: row.step,
                            description: row.description,
                            details: row.details,
                            createdBy: userId,
                            createdAt: row.createdAt || row.createAt ? new Date(row.createdAt || row.createAt) : new Date()
                        };

                        if (row._id) {
                            newStep._id = row._id;
                        } else if (row.object_id) {
                            newStep._id = row.object_id;
                        }

                        newSteps.push(newStep);
                    } catch (rowErr: any) {
                        errors.push(`Row error (step: ${row.step}): ${rowErr.message}`);
                    }
                }

                if (newSteps.length > 0) {
                    operations.push({
                        updateOne: {
                            filter: { _id: recipeId },
                            update: { $push: { steps: { $each: newSteps } } }
                        }
                    });
                }

            } catch (groupErr: any) {
                errors.push(`Group error (${rRef}): ${groupErr.message}`);
            }
        }

        // Execute Bulk Write
        if (operations.length > 0) {
            try {
                const res = await Recipe.bulkWrite(operations, { ordered: false });

                let queuedItems = 0;
                operations.forEach(op => queuedItems += op.updateOne.update.$push.steps.$each.length);

                count = queuedItems;
            } catch (bulkErr: any) {
                console.error("Bulk Write Error:", bulkErr);
                if (bulkErr.writeErrors) {
                    for (const we of bulkErr.writeErrors) {
                        const failedOpIndex = we.index;
                        // const failedOp = operations[failedOpIndex];
                        errors.push(`Write error for recipe: ${we.errmsg}`);
                    }
                } else {
                    errors.push(`Bulk write failed: ${bulkErr.message}`);
                }
            }
        }

        return NextResponse.json({ count, errors });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
