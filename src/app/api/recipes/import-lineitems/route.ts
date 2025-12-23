import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Recipe } from '@/models/Recipe';
import Sku from '@/models/Sku';
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
        const recipeCache = new Map<string, any>(); // Stores full recipe doc or just _id (we need _id)

        // Lookup Helpers
        const findRecipeId = async (rId: string): Promise<string | null> => {
            if (!rId) return null;
            if (recipeCache.has(rId)) return recipeCache.get(rId);

            let recipe;
            if (rId.match(/^[0-9a-fA-F]{24}$/)) {
                recipe = await Recipe.findById(rId).select('_id').lean();
            }
            // If not found by ID or ID not valid, try name/custom _id
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

        // Group data by Recipe Reference (to minimize Recipe lookups and usage of $push)
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

                const newItems: any[] = [];
                for (const row of rows) {
                    try {
                        const skuVal = row.sku;
                        if (!skuVal) throw new Error("SKU required");
                        // We do NOT validate SKU existence as per request

                        const userId = row.createdBy || row.createBy;
                        // We do NOT validate User existence as per request

                        const newItem: any = {
                            sku: skuVal,
                            qty: row.qty,
                            uom: row.uom,
                            createdBy: userId,
                            createdAt: row.createdAt || row.createAt ? new Date(row.createdAt || row.createAt) : new Date()
                        };

                        // Use provided _id if available, otherwise fallback to object_id, otherwise let Mongo generate
                        if (row._id) {
                            newItem._id = row._id;
                        } else if (row.object_id) {
                            newItem._id = row.object_id;
                        }

                        newItems.push(newItem);
                    } catch (rowErr: any) {
                        errors.push(`Row error (sku: ${row.sku}): ${rowErr.message}`);
                    }
                }

                if (newItems.length > 0) {
                    operations.push({
                        updateOne: {
                            filter: { _id: recipeId },
                            update: { $push: { lineItems: { $each: newItems } } }
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
                // Count isn't exactly "rows import" here, it's matched receipts. 
                // We should probably count items pushed. But bulkWrite result gives modifiedCount (recipes).
                // Let's sum up valid items from operations to be properly descriptive if we want users to know item count.
                // However user sees "Imported X items" based on our return.
                // We can calculate total queued items.
                let queuedItems = 0;
                operations.forEach(op => queuedItems += op.updateOne.update.$push.lineItems.$each.length);

                // If no errors in bulkWrite, assume all queued inserted.
                count = queuedItems;
            } catch (bulkErr: any) {
                console.error("Bulk Write Error:", bulkErr);
                if (bulkErr.writeErrors) {
                    for (const we of bulkErr.writeErrors) {
                        const failedOpIndex = we.index;
                        const failedOp = operations[failedOpIndex];
                        // const failedId = failedOp.updateOne.filter._id; 
                        // It's hard to map back to exact rows from here easily without complexity, 
                        // but we know which recipe failed.
                        errors.push(`Write error for recipe: ${we.errmsg}`);
                    }
                } else {
                    errors.push(`Bulk write failed: ${bulkErr.message}`);
                }
                // Fallback count not easily available for individual items in a failed $push batch
            }
        }

        return NextResponse.json({ count, errors });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
