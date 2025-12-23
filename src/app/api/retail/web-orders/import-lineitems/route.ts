import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import Sku from '@/models/Sku';

export const maxDuration = 60;

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        if (!Array.isArray(data) || data.length === 0) {
            return NextResponse.json({ error: 'No data provided' }, { status: 400 });
        }

        // 1. Pre-fetch SKUs to try and resolve IDs (Optimization: cache them all)
        // We can do this efficiently or just look up one by one. 
        // Given potentially large imports, one-by-one inside the loop might be slow, 
        // but let's stick to the map approach we had, it was good.
        const uniqueSkus = new Set<string>();
        data.forEach((row: any) => { if (row.sku) uniqueSkus.add(row.sku); });
        
        const skuDocs = await Sku.find({
            $or: [
                { _id: { $in: Array.from(uniqueSkus).filter(s => s.match(/^[0-9a-fA-F]{24}$/)) } },
                { name: { $in: Array.from(uniqueSkus) } }
            ]
        }).select('_id name').lean();
        
        const skuMap = new Map<string, string>();
        skuDocs.forEach((s: any) => {
            skuMap.set(s._id.toString(), s._id.toString());
            skuMap.set(s.name, s._id.toString());
        });

        const errors: string[] = [];
        let successCount = 0;

        const results = await Promise.all(data.map(async (row: any, index: number) => {
            try {
                if (!row.orderNumber) {
                     return { error: `Row ${index + 1}: Missing orderNumber` };
                }

                // SKU Resolution
                let skuId = skuMap.get(row.sku);
                if (!skuId) {
                    skuId = row.sku; // Fallback to raw string
                }

                // Date Parsing
                const dateRaw = row.createdAt || row.createAt || row['Create At'] || row['Created At'] || row['Date'] || row['date'];
                let finalDate = new Date();
                
                if (dateRaw) {
                    const parsed = new Date(dateRaw);
                    if (!isNaN(parsed.getTime())) {
                        finalDate = parsed;
                    } else {
                        console.warn(`Invalid date format for line item ${row._id}: ${dateRaw}`);
                    }
                }

                const lineItem = {
                    _id: row._id, // Assume MongoID
                    sku: skuId,
                    lotNumber: row.lotNumber,
                    varianceId: row.varianceId,
                    qty: typeof row.qty === 'string' 
                        ? parseFloat(row.qty.replace(/[^0-9.-]+/g, '')) || 0 
                        : parseFloat(row.qty) || 0,
                    total: typeof row.total === 'string' 
                        ? parseFloat(row.total.replace(/[^0-9.-]+/g, '')) || 0 
                        : parseFloat(row.total) || 0,
                    website: row.website,
                    createdAt: finalDate
                };

                // Correct Upsert Logic for Subdocument Array
                // 1. Attempt to update existing line item with this _id
                const updateOp = await WebOrder.updateOne(
                    { _id: row.orderNumber, "lineItems._id": row._id },
                    { $set: { "lineItems.$": lineItem } },
                    { timestamps: false }
                );

                // 2. If no document matched, it means either Order doesn't exist OR Item doesn't exist in that order.
                // We try to PUSH.
                if (updateOp.matchedCount === 0) {
                    const pushOp = await WebOrder.updateOne(
                        { _id: row.orderNumber },
                        { $push: { lineItems: lineItem } },
                        { timestamps: false }
                    );

                    if (pushOp.matchedCount === 0) {
                        return { error: `Order not found: ${row.orderNumber}` };
                    }
                }

                return { success: true };

            } catch (err: any) {
                return { error: `Row ${index + 1}: ${err.message}` };
            }
        }));

        results.forEach(r => {
            if (r.error) errors.push(r.error);
            else successCount++;
        });

        return NextResponse.json({
            success: true,
            count: successCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        console.error('Web Order Line Item Import Error:', error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
