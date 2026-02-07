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

        // Helper to clean string values
        const cleanStr = (val: any): string | undefined => {
            if (val === undefined || val === null || val === '' || val === '#N/A') return undefined;
            return String(val);
        };

        // Helper to parse date safely
        const parseDate = (val: any): Date => {
            if (!val || val === '#N/A' || val === '') return new Date();
            const parsed = new Date(val);
            return isNaN(parsed.getTime()) ? new Date() : parsed;
        };

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

        // Group rows by woNumber
        const groups = new Map<string, any[]>();
        for (const row of data) {
            const woRef = row.woNumber || '';
            if (!woRef || woRef === '#N/A') continue;
            if (!groups.has(woRef)) groups.set(woRef, []);
            groups.get(woRef)!.push(row);
        }

        const operations: any[] = [];

        for (const [woRef, rows] of groups.entries()) {
            const mfgId = mfgMap.get(woRef);
            if (!mfgId) {
                errors.push(`Manufacturing order not found for woNumber '${woRef}' (${rows.length} rows)`);
                continue;
            }

            const newLabor: any[] = [];
            for (const row of rows) {
                newLabor.push({
                    _id: new mongoose.Types.ObjectId(),
                    type: cleanStr(row.type),
                    user: cleanStr(row.user),
                    duration: cleanStr(row.duration),
                    hourlyRate: parseNum(row.hourlyRate),
                    createdAt: parseDate(row.createdAt)
                });
            }

            if (newLabor.length > 0) {
                operations.push({
                    updateOne: {
                        filter: { _id: new mongoose.Types.ObjectId(mfgId) },
                        update: { $push: { labor: { $each: newLabor } } }
                    }
                });
            }
        }

        if (operations.length > 0) {
            try {
                await Manufacturing.bulkWrite(operations, { ordered: false });
                operations.forEach(op => count += op.updateOne.update.$push.labor.$each.length);
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
        console.error('Manufacturing Labor Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
