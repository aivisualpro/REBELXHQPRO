import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import { getLotsWithBalances } from '@/lib/lot-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/warehouse/skus/[id]/lots
 * 
 * Returns all lots for a SKU with accurate balances.
 * Supports lookup by both MongoDB ObjectId and legacyId.
 * Uses the centralized lot-helpers which properly tracks:
 * - Sources: Opening Balance, Purchase Orders, Manufacturing, Audit Adjustments
 * - Consumptions: Sale Orders, Web Orders, Manufacturing Ingredients
 * 
 * IMPORTANT: Only lots with SOURCE transactions are returned.
 * Orphan lot numbers (only found in consumption records) are NOT included.
 */
export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();

        const params = await props.params;
        const { id } = params;

        // SKU _id is declared as String in Mongoose schema but many records store _id as ObjectId in MongoDB.
        // Mongoose's findById casts to String, causing a BSON type mismatch.
        // Use the native MongoDB driver to bypass Mongoose's type casting.
        let sku: any = null;
        const isValidObjectId = mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);

        const db = mongoose.connection.db;
        if (db) {
            // Query with both String and ObjectId types to handle BSON type drift
            const query: any = isValidObjectId
                ? { $or: [{ _id: id }, { _id: new mongoose.Types.ObjectId(id) }] }
                : { _id: id };
            sku = await db.collection('skus').findOne(query);
        }

        // Fallback: lookup by legacyId
        if (!sku) {
            sku = await Sku.findOne({ legacyId: id }).lean();
        }

        if (!sku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        // Always use the actual _id for lot queries (lot-helpers match on ObjectId references)
        const skuObjectId = sku._id.toString();

        // Use the centralized lot helper for accurate balances
        const lots = await getLotsWithBalances(skuObjectId);
        
        // Format for frontend compatibility
        const formattedLots = lots.map(lot => ({
            lotNumber: lot.lotNumber,
            balance: lot.balance,
            source: lot.source,
            date: lot.date ? lot.date.toISOString() : null,
            cost: lot.cost
        }));

        return NextResponse.json({
            sku,
            lots: formattedLots
        });

    } catch (error: any) {
        console.error("Error fetching SKU lots:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
