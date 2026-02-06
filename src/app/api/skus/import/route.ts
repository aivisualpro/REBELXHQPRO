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

        // Debug: log column headers from the first row
        if (skus.length > 0) {
            console.log('SKU Import - Total rows received:', skus.length);
            console.log('SKU Import - Column headers:', Object.keys(skus[0]));
            console.log('SKU Import - First row sample:', JSON.stringify(skus[0]).substring(0, 500));
        }

        const validSkus = skus
            .filter((item: any) => item.name || item.Name || item['SKU Name'] || item['Product Name']) // Accept multiple column name variations
            .map((item: any) => {
                // Normalize column names - accept common variations
                const name = item.name || item.Name || item['SKU Name'] || item['Product Name'] || '';
                
                const doc: any = {
                    ...item,
                    name, // Ensure normalized name is set
                    legacyId: item.legacyId || item.LegacyId || item['Legacy ID'] || item['legacy_id'] || undefined,
                    category: item.category || item.Category || undefined,
                    // Ensure booleans are correctly parsed if coming from CSV string
                    kitApplied: item.kitApplied === 'true' || item.kitApplied === true || item.kitApplied === 'TRUE' || item.kitApplied === '1',
                    isLotApplied: item.isLotApplied === 'true' || item.isLotApplied === true || item.isLotApplied === 'TRUE' || item.isLotApplied === '1',
                    salePrice: Number(item.salePrice || item.SalePrice || item['Sale Price'] || 0) || 0,
                    orderUpto: Number(item.orderUpto || item.OrderUpto || 0) || 0,
                    reOrderPoint: Number(item.reOrderPoint || item.ReOrderPoint || 0) || 0
                };
                
                // Clean up duplicate/variant keys
                delete doc._id;
                delete doc.sku;
                delete doc.Name;
                delete doc['SKU Name'];
                delete doc['Product Name'];
                delete doc.LegacyId;
                delete doc['Legacy ID'];
                delete doc['legacy_id'];
                delete doc.Category;
                delete doc.SalePrice;
                delete doc['Sale Price'];
                delete doc.OrderUpto;
                delete doc.ReOrderPoint;
                
                return {
                    original: item,
                    doc
                };
            });

        console.log('SKU Import - Valid rows after filtering:', validSkus.length);

        if (validSkus.length === 0) {
            return NextResponse.json({ 
                message: 'No valid SKUs to import. Check CSV has a "name" column.', 
                count: 0,
                headers: skus.length > 0 ? Object.keys(skus[0]) : []
            });
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

        console.log('SKU Import - bulkWrite result:', {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            upsertedCount: result.upsertedCount,
            operations: operations.length
        });

        return NextResponse.json({ 
            message: 'Import completed', 
            count: result.upsertedCount + result.matchedCount,
            details: {
                new: result.upsertedCount,
                updated: result.matchedCount,
                changed: result.modifiedCount
            }
        });
    } catch (error: any) {
        console.error('SKU Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
