import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import { Kit } from '@/models/Kit';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
        }

        let count = 0;
        const errors: string[] = [];

        // Build SKU lookup map (legacyId -> _id) using raw driver
        const db = mongoose.connection.db;
        const skuMap = new Map<string, string>();
        if (db) {
            const allSkus = await db.collection('skus').find(
                {},
                { projection: { _id: 1, legacyId: 1, name: 1 } }
            ).toArray();
            allSkus.forEach((s: any) => {
                if (s.legacyId) skuMap.set(String(s.legacyId), s._id.toString());
                skuMap.set(s._id.toString(), s._id.toString());
                if (s.name) skuMap.set(s.name.toLowerCase(), s._id.toString());
            });
        }

        // Build kit lookup map (legacyId -> _id)
        const kitMap = new Map<string, string>();
        if (db) {
            const allKits = await db.collection('kits').find(
                {},
                { projection: { _id: 1, legacyId: 1, name: 1 } }
            ).toArray();
            allKits.forEach((k: any) => {
                if (k.legacyId) kitMap.set(String(k.legacyId), k._id.toString());
                kitMap.set(k._id.toString(), k._id.toString());
                if (k.name) kitMap.set(k.name, k._id.toString());
            });
        }

        // Group rows by kitId
        const groups = new Map<string, any[]>();
        for (const row of data) {
            const kRef = row.kitId || '';
            if (!kRef) { errors.push(`Row missing kitId (sku: ${row.sku})`); continue; }
            if (!groups.has(kRef)) groups.set(kRef, []);
            groups.get(kRef)!.push(row);
        }

        const operations: any[] = [];

        for (const [kRef, rows] of groups.entries()) {
            // Resolve kit by legacyId first
            const kitId = kitMap.get(kRef);
            if (!kitId) {
                errors.push(`Kit not found for '${kRef}' (${rows.length} rows)`);
                continue;
            }

            const newItems: any[] = [];
            for (const row of rows) {
                try {
                    const skuInput = String(row.sku || '').trim();
                    if (!skuInput) throw new Error('SKU required');

                    // Resolve SKU by legacyId
                    const resolvedSku = skuMap.get(skuInput) || skuMap.get(skuInput.toLowerCase());
                    if (!resolvedSku) throw new Error(`SKU '${skuInput}' not found`);

                    newItems.push({
                        _id: new mongoose.Types.ObjectId(),
                        sku: resolvedSku,
                        qty: parseFloat(row.qty) || 0
                    });
                } catch (rowErr: any) {
                    errors.push(`Row error (sku: ${row.sku}): ${rowErr.message}`);
                }
            }

            if (newItems.length > 0) {
                operations.push({
                    updateOne: {
                        filter: { _id: new mongoose.Types.ObjectId(kitId) },
                        update: { $push: { lineItems: { $each: newItems } } }
                    }
                });
            }
        }

        if (operations.length > 0) {
            try {
                await Kit.bulkWrite(operations, { ordered: false });
                let queuedItems = 0;
                operations.forEach(op => queuedItems += op.updateOne.update.$push.lineItems.$each.length);
                count = queuedItems;
            } catch (bulkErr: any) {
                console.error('Bulk Write Error:', bulkErr);
                if (bulkErr.writeErrors) {
                    for (const we of bulkErr.writeErrors) {
                        errors.push(`Write error: ${we.errmsg}`);
                    }
                } else {
                    errors.push(`Bulk write failed: ${bulkErr.message}`);
                }
            }
        }

        return NextResponse.json({ count, errors });
    } catch (error: any) {
        console.error('Kit Line Items Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
