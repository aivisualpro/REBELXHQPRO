import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        const variances = Array.isArray(data) ? data : body.variances;

        if (!Array.isArray(variances)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        console.log(`Processing ${variances.length} variances for import...`);

        // CSV format: legacyId, sku, name, website, image
        // - 'sku' column = the parent SKU's legacyId (used to find parent)
        // - 'legacyId' column = the variance's own legacyId
        
        // Build lookup map: parent's legacyId -> parent's _id
        const parentLegacyIds = variances.map((v: any) => v.sku).filter(Boolean);
        const existingSkus = await Sku.find({ 
            legacyId: { $in: parentLegacyIds }
        }).select('_id legacyId name variances').lean();
        
        const legacyIdToSku = new Map<string, any>();
        existingSkus.forEach((sku: any) => {
            if (sku.legacyId) {
                legacyIdToSku.set(sku.legacyId, sku);
            }
        });

        console.log(`Found ${legacyIdToSku.size} parent SKUs in database`);

        let successCount = 0;
        let errorCount = 0;
        const operations: any[] = [];

        for (const item of variances) {
            if (!item.name || !item.sku) {
                console.log(`Skipping item - missing name or sku: ${JSON.stringify(item)}`);
                errorCount++;
                continue;
            }

            // Find parent by matching item.sku to database legacyId
            const parentSku = legacyIdToSku.get(item.sku);
            
            if (!parentSku) {
                console.log(`Parent not found for sku: "${item.sku}" (variance: ${item.legacyId || item.name})`);
                errorCount++;
                continue;
            }

            // Use legacyId directly for filtering to avoid any _id type confusion (String vs ObjectId)
            // We already verified matches via the map lookup

            // Check if variance already exists
            const existingVariance = parentSku.variances?.find((v: any) => v.legacyId === item.legacyId);
            
            if (existingVariance) {
                // Update existing variance
                operations.push({
                    updateOne: {
                        filter: { 
                            legacyId: item.sku,
                            'variances.legacyId': item.legacyId
                        },
                        update: {
                            $set: {
                                'variances.$.name': item.name,
                                'variances.$.website': item.website || '',
                                'variances.$.image': item.image || ''
                            }
                        }
                    }
                });
            } else {
                // Add new variance
                operations.push({
                    updateOne: {
                        filter: { legacyId: item.sku },
                        update: {
                            $push: {
                                variances: {
                                    _id: new mongoose.Types.ObjectId().toString(),
                                    legacyId: item.legacyId || '',
                                    name: item.name,
                                    website: item.website || '',
                                    image: item.image || '',
                                    sku: '',
                                    status: 'active'
                                }
                            }
                        }
                    }
                });
            }
            successCount++;
        }

        console.log(`Prepared ${operations.length} operations, ${errorCount} errors`);

        if (operations.length === 0) {
            return NextResponse.json({ 
                message: 'No valid variances to import', 
                count: 0,
                errors: errorCount
            });
        }

        // Log a sample operation for debugging
        if (operations.length > 0) {
            console.log('Sample operation:', JSON.stringify(operations[0], null, 2));
        }

        const result = await Sku.bulkWrite(operations);

        console.log(`BulkWrite result: matched=${result.matchedCount}, modified=${result.modifiedCount}, upserted=${result.upsertedCount}`);

        return NextResponse.json({
            message: 'Variances import completed',
            count: result.modifiedCount,
            matched: result.matchedCount,
            prepared: successCount,
            errors: errorCount
        });
    } catch (error: any) {
        console.error('Variances Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
