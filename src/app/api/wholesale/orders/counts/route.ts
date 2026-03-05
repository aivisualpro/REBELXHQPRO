import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import mongoose from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════════
// GET — Aggregated status counts across the entire wholesale orders collection.
// Uses a single $group stage on the indexed `orderStatus` field for O(index-scan)
// performance. Returns { counts: { All: N, Pending: N, Picking: N, ... } }
// ═══════════════════════════════════════════════════════════════════════════════

let statusIndexEnsured = false;

export async function GET() {
    try {
        await dbConnect();

        // Ensure index on orderStatus for fast grouping (once per cold start)
        if (!statusIndexEnsured) {
            statusIndexEnsured = true;
            try {
                const db = mongoose.connection.db;
                if (db) {
                    await db.collection('saleorders').createIndex(
                        { orderStatus: 1 },
                        { background: true }
                    );
                }
            } catch { /* index already exists */ }
        }

        // Single aggregation pipeline — groups ALL documents by orderStatus
        const pipeline = [
            {
                $group: {
                    _id: '$orderStatus',
                    count: { $sum: 1 }
                }
            }
        ];

        const results = await SaleOrder.aggregate(pipeline);

        // Build structured counts map
        const counts: Record<string, number> = {
            All: 0,
            Pending: 0,
            Picking: 0,
            Shipping: 0,
            'Pending Payment': 0,
            Issued: 0,
            Completed: 0,
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
