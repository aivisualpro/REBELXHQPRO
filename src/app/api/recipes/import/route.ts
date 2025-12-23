import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Recipe } from '@/models/Recipe';
import Sku from '@/models/Sku';
import User from '@/models/User';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json(); // Validates body

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
        }

        let count = 0;
        const errors: string[] = [];

        // Caches to prevent redundant lookups in the same batch
        const skuCache = new Map<string, string | null>();
        const userCache = new Map<string, string | null>();

        // Helper to find SKU
        const findSku = async (skuId: string): Promise<string | null> => {
            if (!skuId) return null;
            if (skuCache.has(skuId)) return skuCache.get(skuId) || null;

            const s = await Sku.findOne({
                $or: [
                    { _id: skuId },
                    { name: { $regex: new RegExp(`^${skuId}$`, 'i') } }
                ]
            }).lean(); // Use lean for speed

            const result = s ? (s as any)._id : null;
            skuCache.set(skuId, result);
            return result;
        };

        // Helper to find User
        const findUser = async (userId: string): Promise<string | null> => {
            if (!userId) return null;
            const cacheKey = String(userId);
            if (userCache.has(cacheKey)) return userCache.get(cacheKey) || null;

            let finalUserId: string | null = null;
            const userById = await User.findOne({ _id: userId }).lean();

            if (userById) {
                finalUserId = (userById as any)._id;
            } else {
                // Fuzzy search
                const searchVal = String(userId);
                const parts = searchVal.split(' ');
                const query: any = { $or: [] };
                query.$or.push({ email: { $regex: new RegExp(`^${searchVal}$`, 'i') } });
                query.$or.push({ firstName: { $regex: new RegExp(`^${parts[0]}$`, 'i') } });
                if (parts.length > 1) {
                    query.$or.push({ lastName: { $regex: new RegExp(`^${parts[parts.length - 1]}$`, 'i') } });
                }
                const u = await User.findOne(query).lean();
                if (u) finalUserId = (u as any)._id;
            }

            userCache.set(cacheKey, finalUserId);
            return finalUserId;
        };

        // Process rows in parallel
        const processedResults = await Promise.all(data.map(async (row, index) => {
            try {
                // Normalize keys
                const normalizedRow: any = { ...row };
                if (row.createBy && !row.createdBy) normalizedRow.createdBy = row.createBy;
                if (row.createAt && !row.createdAt) normalizedRow.createdAt = row.createAt;

                // Lookup SKU
                const skuIdInput = normalizedRow.sku;
                if (!skuIdInput) throw new Error("SKU is required");

                const skuId = await findSku(skuIdInput);
                if (!skuId) throw new Error(`SKU '${skuIdInput}' not found`);

                // Lookup User
                const userIdInput = normalizedRow.createdBy;
                const finalUserId = userIdInput ? await findUser(userIdInput) : undefined;

                // Validate
                if (!normalizedRow.name) throw new Error("Name is required");
                if (normalizedRow.qty === undefined || normalizedRow.qty === null) throw new Error("Qty is required");

                // Construct Doc
                return {
                    ...normalizedRow,
                    sku: skuId,
                    createdBy: finalUserId,
                    lineItems: [],
                    steps: []
                };
            } catch (e: any) {
                const rowName = row.name || `Row ${index + 1}`;
                errors.push(`Row error (${rowName}): ${e.message}`);
                return null;
            }
        }));

        const validRecipes = processedResults.filter(r => r !== null);

        if (validRecipes.length > 0) {
            if (validRecipes.length > 0) {
                try {
                    const operations = validRecipes.map(recipe => {
                        if (recipe._id) {
                            return {
                                replaceOne: {
                                    filter: { _id: recipe._id },
                                    replacement: recipe,
                                    upsert: true
                                }
                            };
                        } else {
                            return {
                                insertOne: {
                                    document: recipe
                                }
                            };
                        }
                    });

                    // Bulk Write (Upsert/Insert)
                    const result = await Recipe.bulkWrite(operations, { ordered: false });
                    count = (result.insertedCount || 0) + (result.modifiedCount || 0) + (result.upsertedCount || 0);

                } catch (bulkError: any) {
                    console.error("Bulk Write Error Details:", bulkError);

                    // Handle partial counts if available in error
                    if (bulkError.result) {
                        const res = bulkError.result;
                        count = (res.nInserted || 0) + (res.nModified || 0) + (res.nUpserted || 0);
                    }

                    if (bulkError.writeErrors) {
                        for (const we of bulkError.writeErrors) {
                            const failedIndex = we.index;
                            const failedDoc = validRecipes[failedIndex];
                            const id = failedDoc?.name || 'Unknown';
                            const msg = we.errmsg || we.message || JSON.stringify(we);
                            errors.push(`Write error (${id}): ${msg}`);
                        }
                    } else {
                        errors.push(`Bulk write failed: ${bulkError.message}`);
                    }
                }
            }
        }

        return NextResponse.json({ count, errors });
    } catch (error: any) {
        console.error("Recipe Import Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
