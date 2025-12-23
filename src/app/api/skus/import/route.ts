import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { skus } = body;

        if (!Array.isArray(skus)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const validSkus = skus
            .filter((item: any) => item.sku && item.name) // valid rows needs sku and name at least
            .map((item: any) => ({
                ...item,
                _id: item.sku, // Map sku to _id
                // Ensure booleans are correctly parsed if coming from CSV string
                kitApplied: item.kitApplied === 'true' || item.kitApplied === true,
                isLotApplied: item.isLotApplied === 'true' || item.isLotApplied === true,
                salePrice: Number(item.salePrice) || 0,
                orderUpto: Number(item.orderUpto) || 0,
                reOrderPoint: Number(item.reOrderPoint) || 0
            }));

        if (validSkus.length === 0) {
            return NextResponse.json({ message: 'No valid SKUs to import', count: 0 });
        }

        // Use bulkWrite to handle potential duplicate keys (upsert or skip) or just insertMany (fails on duplicate)
        // User didn't specify behavior on duplicate, but standard import usually expects new data.
        // Let's use ordered: false to continue if some fail, but plain insertMany might error out block.
        // Changing to bulkWrite for Upsert behavior is usually safer for re-imports.

        const operations = validSkus.map((sku: any) => ({
            updateOne: {
                filter: { _id: sku._id },
                update: { $set: sku },
                upsert: true
            }
        }));

        const result = await Sku.bulkWrite(operations);

        return NextResponse.json({ message: 'Import completed', count: result.upsertedCount + result.modifiedCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
