import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import mongoose from 'mongoose';

let indexEnsured = false;

export async function GET() {
    try {
        await dbConnect();
        if (!indexEnsured) {
            indexEnsured = true;
            try {
                const db = mongoose.connection.db;
                if (db) await db.collection('weborders').createIndex({ status: 1 }, { background: true });
            } catch { /* index exists */ }
        }
        const results = await WebOrder.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
        const counts: Record<string, number> = { All: 0, processing: 0, completed: 0, 'on-hold': 0, pending: 0, cancelled: 0, refunded: 0, failed: 0 };
        for (const row of results) {
            const s = row._id as string;
            if (s && counts.hasOwnProperty(s)) counts[s] = row.count;
            counts.All += row.count;
        }
        return NextResponse.json({ counts });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
