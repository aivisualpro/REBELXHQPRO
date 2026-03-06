import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET() {
    try {
        await dbConnect();
        const results = await User.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
        const counts: Record<string, number> = { All: 0, Active: 0, Inactive: 0 };
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
