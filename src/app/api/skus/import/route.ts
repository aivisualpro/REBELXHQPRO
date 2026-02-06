import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body; // Changed from 'skus' to 'data' for consistency with settings import pattern

        const skus = Array.isArray(data) ? data : body.skus; // Fallback to old format
        
        if (!Array.isArray(skus)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const validSkus = skus
            .filter((item: any) => item.name) // Valid rows need name at least
            .map((item: any) => {
                const doc: any = {
                    ...item,
                    legacyId: item.legacyId || undefined,
                    // Ensure booleans are correctly parsed if coming from CSV string
                    kitApplied: item.kitApplied === 'true' || item.kitApplied === true || item.kitApplied === 'TRUE' || item.kitApplied === '1',
                    isLotApplied: item.isLotApplied === 'true' || item.isLotApplied === true || item.isLotApplied === 'TRUE' || item.isLotApplied === '1',
                    salePrice: Number(item.salePrice) || 0,
                    orderUpto: Number(item.orderUpto) || 0,
                    reOrderPoint: Number(item.reOrderPoint) || 0
                };
                
                // Remove _id from the update doc if present - we'll use it only for filtering
                delete doc._id;
                delete doc.sku; // Also remove sku if present (it was previously used as _id)
                
                return {
                    original: item,
                    doc
                };
            });

        if (validSkus.length === 0) {
            return NextResponse.json({ message: 'No valid SKUs to import', count: 0 });
        }

        // Build operations - prioritize legacyId for matching
        const operations = validSkus.map(({ original, doc }) => {
            // Determine the filter: use legacyId if available, otherwise use _id/sku
            let filter: any;
            
            if (original.legacyId) {
                // If we have a legacyId, use it as the primary match criterion
                filter = { legacyId: original.legacyId };
            } else if (original._id || original.sku) {
                // Fallback to _id or sku
                filter = { _id: original._id || original.sku };
            } else {
                // No identifier - this will create a new document with auto-generated _id
                // Use a non-existent legacyId to force upsert to create new
                filter = { legacyId: `NEW-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
            }
            
            return {
                updateOne: {
                    filter,
                    update: { $set: doc },
                    upsert: true
                }
            };
        });

        const result = await Sku.bulkWrite(operations);

        return NextResponse.json({ 
            message: 'Import completed', 
            count: result.upsertedCount + result.modifiedCount 
        });
    } catch (error: any) {
        console.error('SKU Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
