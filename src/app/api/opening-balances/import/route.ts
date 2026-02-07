import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import OpeningBalance from '@/models/OpeningBalance';
import Sku from '@/models/Sku';
import mongoose from 'mongoose';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!data || !Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const operations = [];
        const errors: string[] = [];

        // 1. Collect potential SKU identifiers
        const skuIdentifiers = new Set<string>();
        data.forEach((row: any) => {
            if (row.sku) skuIdentifiers.add(row.sku.toString().trim());
        });

        // 2. Fetch SKUs to resolve by legacyId (CSV sku column = legacyId)
        const matchingSkus = await Sku.find({
            $or: [
                { legacyId: { $in: Array.from(skuIdentifiers) } },
                { _id: { $in: Array.from(skuIdentifiers) } },
                { name: { $in: Array.from(skuIdentifiers) } }
            ]
        }).select('_id name legacyId').lean();

        const skuMap = new Map<string, string>();
        matchingSkus.forEach(s => {
            skuMap.set(s._id.toString(), s._id.toString());
            if (s.name) skuMap.set(s.name, s._id.toString());
            if ((s as any).legacyId) skuMap.set((s as any).legacyId.toString(), s._id.toString());
        });

        // 3. Build Operations
        for (const [index, row] of data.entries()) {
            // sanitize
            const sku = row.sku?.toString().trim();
            const lotNumber = row.lotNumber?.toString().trim();
            const qty = row.qty; // keep raw for parsing

            // Validation
            const missing = [];
            if (!sku) missing.push('sku');
            if (!lotNumber) missing.push('lotNumber');
            if (qty === undefined || qty === null || qty === '') missing.push('qty');

            if (missing.length > 0) {
                errors.push(`Row ${index + 1}: Missing fields: ${missing.join(', ')}`);
                continue;
            }

            const resolvedSkuId = skuMap.get(sku);
            if (!resolvedSkuId) {
                // Silently skip rows with unresolved SKUs
                continue;
            }

            const payload: any = {
                sku: resolvedSkuId,
                lotNumber: lotNumber,
                qty: parseFloat(qty),
                uom: row.uom?.toString().trim() || 'EA',
                cost: row.cost !== undefined && row.cost !== null && row.cost !== '' ? parseFloat(row.cost) : 0,
                createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
            };

            // Only set createdBy if it's a valid ObjectId
            if (row.createdBy && mongoose.Types.ObjectId.isValid(row.createdBy)) {
                payload.createdBy = new mongoose.Types.ObjectId(row.createdBy);
            }

            if (row.expirationDate) payload.expirationDate = new Date(row.expirationDate);

            if (row._id && mongoose.Types.ObjectId.isValid(row._id)) {
                // Upsert by ID
                payload._id = new mongoose.Types.ObjectId(row._id);
                operations.push({
                    updateOne: {
                        filter: { _id: payload._id },
                        update: { $set: payload },
                        upsert: true
                    }
                });
            } else {
                // Insert New with auto ObjectId
                payload._id = new mongoose.Types.ObjectId();
                operations.push({
                    insertOne: {
                        document: payload
                    }
                });
            }
        }

        let result: any = { insertedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        if (operations.length > 0) {
            result = await OpeningBalance.bulkWrite(operations, { ordered: false });
            console.log('Import BulkWrite Result:', result);
        }

        return NextResponse.json({
            count: (result.insertedCount || 0) + (result.modifiedCount || 0) + (result.upsertedCount || 0),
            errors
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
