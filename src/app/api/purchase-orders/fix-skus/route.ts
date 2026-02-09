import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

/**
 * GET /api/purchase-orders/fix-skus
 * 
 * One-time migration: scans all PO lineItems where `sku` is a legacy string
 * (not a valid ObjectId or not matching any SKU._id) and replaces it with the
 * actual SKU _id looked up from the `skus` collection by legacyId.
 */
export async function GET() {
    try {
        await dbConnect();
        const db = mongoose.connection.db!;

        // 1. Build SKU lookup map: legacyId → _id  (case-insensitive)
        const allSkus = await db.collection('skus')
            .find({}, { projection: { _id: 1, legacyId: 1, name: 1 } })
            .toArray();

        const skuMap = new Map<string, string>();
        allSkus.forEach((s: any) => {
            const id = s._id.toString();
            // Map by _id
            skuMap.set(id.toLowerCase(), id);
            // Map by legacyId
            if (s.legacyId) skuMap.set(s.legacyId.trim().toLowerCase(), id);
        });

        console.log(`[fix-skus] Built SKU map with ${skuMap.size} entries from ${allSkus.length} SKUs`);

        // 2. Fetch all POs that have lineItems
        const allPOs = await db.collection('purchaseorders')
            .find({ 'lineItems.0': { $exists: true } })
            .toArray();

        let totalFixed = 0;
        let totalSkipped = 0;
        let totalNotFound = 0;
        const notFoundSkus = new Set<string>();

        for (const po of allPOs) {
            let changed = false;
            const updatedItems = (po.lineItems || []).map((item: any) => {
                if (!item.sku || typeof item.sku !== 'string') return item;

                const skuStr = item.sku.toString().trim();
                const skuKey = skuStr.toLowerCase();

                // Check if already a valid SKU _id
                const resolvedId = skuMap.get(skuKey);
                if (resolvedId) {
                    if (resolvedId !== skuStr) {
                        // Legacy ID → replace with actual _id
                        changed = true;
                        totalFixed++;
                        return { ...item, sku: resolvedId };
                    } else {
                        totalSkipped++; // Already correct
                        return item;
                    }
                } else {
                    totalNotFound++;
                    notFoundSkus.add(skuStr);
                    return item;
                }
            });

            if (changed) {
                await db.collection('purchaseorders').updateOne(
                    { _id: po._id },
                    { $set: { lineItems: updatedItems } }
                );
            }
        }

        return NextResponse.json({
            message: 'SKU fix migration completed',
            totalPOs: allPOs.length,
            totalFixed,
            totalSkipped,
            totalNotFound,
            notFoundSkus: Array.from(notFoundSkus)
        });
    } catch (error: any) {
        console.error('[fix-skus] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
