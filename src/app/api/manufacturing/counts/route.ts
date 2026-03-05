import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import mongoose from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════════
// GET — Aggregated status counts across the entire manufacturing collection.
// Uses a single $group stage on the indexed `status` field for O(index-scan)
// performance. Returns { counts: { All: N, Pending: N, Processing: N, ... } }
// ═══════════════════════════════════════════════════════════════════════════════

let statusIndexEnsured = false;

export async function GET() {
    try {
        await dbConnect();

        // Ensure compound index on status for fast grouping (once per cold start)
        if (!statusIndexEnsured) {
            statusIndexEnsured = true;
            try {
                const db = mongoose.connection.db;
                if (db) {
                    await db.collection('manufacturings').createIndex(
                        { status: 1 },
                        { background: true }
                    );
                }
            } catch { /* index already exists */ }
        }

        // Single aggregation pipeline — groups ALL documents by status
        const pipeline = [
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ];

        const results = await Manufacturing.aggregate(pipeline);

        // Build structured counts map
        const counts: Record<string, number> = {
            All: 0,
            Pending: 0,
            Processing: 0,
            'Ready to QC': 0,
            Fulfilled: 0,
        };

        for (const row of results) {
            const status = row._id as string;
            if (status && counts.hasOwnProperty(status)) {
                counts[status] = row.count;
            }
            counts.All += row.count;
        }

        return NextResponse.json({ counts });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
