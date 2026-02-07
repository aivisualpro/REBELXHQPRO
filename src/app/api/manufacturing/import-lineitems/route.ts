import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
        }

        const db = mongoose.connection.db;

        // Helper to parse numbers from CSV strings
        const parseNum = (val: any): number | undefined => {
            if (val === undefined || val === null || val === '' || val === '#N/A') return undefined;
            const cleaned = String(val).replace(/[^0-9.\-]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? undefined : num;
        };

        // Build SKU lookup map (legacyId -> _id)
        const skuMap = new Map<string, string>();
        if (db) {
            const allSkus = await db.collection('skus').find(
                {},
                { projection: { _id: 1, legacyId: 1 } }
            ).toArray();
            allSkus.forEach((s: any) => {
                if (s.legacyId) skuMap.set(String(s.legacyId), s._id.toString());
                skuMap.set(s._id.toString(), s._id.toString());
            });
        }

        // Build Recipe lookup map (legacyId -> _id)
        const recipeMap = new Map<string, string>();
        if (db) {
            const allRecipes = await db.collection('recipes').find(
                {},
                { projection: { _id: 1, legacyId: 1 } }
            ).toArray();
            allRecipes.forEach((r: any) => {
                if (r.legacyId) recipeMap.set(String(r.legacyId), r._id.toString());
                recipeMap.set(r._id.toString(), r._id.toString());
            });
        }

        // Build Manufacturing lookup map (legacyId -> _id)
        const mfgMap = new Map<string, string>();
        if (db) {
            const allMfg = await db.collection('manufacturings').find(
                {},
                { projection: { _id: 1, legacyId: 1 } }
            ).toArray();
            allMfg.forEach((m: any) => {
                if (m.legacyId) mfgMap.set(String(m.legacyId), m._id.toString());
                mfgMap.set(m._id.toString(), m._id.toString());
            });
        }

        let count = 0;
        const errors: string[] = [];

        // Group rows by woNumber (parent manufacturing legacyId)
        const groups = new Map<string, any[]>();
        for (const row of data) {
            const woRef = row.woNumber || '';
            if (!woRef) { errors.push(`Row missing woNumber (sku: ${row.sku})`); continue; }
            if (!groups.has(woRef)) groups.set(woRef, []);
            groups.get(woRef)!.push(row);
        }

        const operations: any[] = [];

        for (const [woRef, rows] of groups.entries()) {
            // Resolve manufacturing order by legacyId
            const mfgId = mfgMap.get(woRef);
            if (!mfgId) {
                errors.push(`Manufacturing order not found for woNumber '${woRef}' (${rows.length} rows)`);
                continue;
            }

            const newItems: any[] = [];
            for (const row of rows) {
                try {
                    // Resolve SKU by legacyId
                    const skuInput = String(row.sku || '').trim();
                    const resolvedSku = skuMap.get(skuInput) || skuInput;

                    // Resolve Recipe by legacyId
                    const recipeInput = String(row.recipeId || '').trim();
                    const resolvedRecipe = recipeMap.get(recipeInput) || recipeInput || undefined;

                    newItems.push({
                        _id: new mongoose.Types.ObjectId(),
                        lotNumber: row.lotNumber || undefined,
                        label: row.label || undefined,
                        recipeId: resolvedRecipe,
                        sku: resolvedSku,
                        uom: row.uom || undefined,
                        recipeQty: parseNum(row.recipeQty),
                        sa: parseNum(row.sa),
                        qtyExtra: parseNum(row.qtyExtra),
                        qtyScrapped: parseNum(row.qtyScrapped),
                        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
                        createdBy: row.createdBy || row.createBy || undefined
                    });
                } catch (rowErr: any) {
                    errors.push(`Row error (sku: ${row.sku}): ${rowErr.message}`);
                }
            }

            if (newItems.length > 0) {
                operations.push({
                    updateOne: {
                        filter: { _id: new mongoose.Types.ObjectId(mfgId) },
                        update: { $push: { lineItems: { $each: newItems } } }
                    }
                });
            }
        }

        if (operations.length > 0) {
            try {
                await Manufacturing.bulkWrite(operations, { ordered: false });
                operations.forEach(op => count += op.updateOne.update.$push.lineItems.$each.length);
            } catch (bulkErr: any) {
                console.error('Bulk Write Error:', bulkErr);
                if (bulkErr.writeErrors) {
                    for (const we of bulkErr.writeErrors) errors.push(`Write error: ${we.errmsg}`);
                } else {
                    errors.push(`Bulk write failed: ${bulkErr.message}`);
                }
            }
        }

        return NextResponse.json({ count, errors });
    } catch (error: any) {
        console.error('Manufacturing Line Items Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
