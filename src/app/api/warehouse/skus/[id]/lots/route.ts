import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import { getLotsWithBalances } from '@/lib/lot-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/warehouse/skus/[id]/lots
 * 
 * Returns all lots for a SKU with accurate balances.
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

        const sku = await Sku.findOne({ _id: id }).lean();
        if (!sku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        // Use the centralized lot helper for accurate balances
        const lots = await getLotsWithBalances(id);
        
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
