import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TimeSheet from '@/models/TimeSheet';

export const dynamic = 'force-dynamic';

// GET: Check if user has an active clock-in today (entry with no timeOut)
export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const user = searchParams.get('user');
        if (!user) {
            return NextResponse.json({ active: null });
        }

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const active = await TimeSheet.findOne({
            user,
            date: { $gte: startOfDay, $lt: endOfDay },
            $or: [{ timeOut: '' }, { timeOut: { $exists: false } }, { timeOut: null }],
        }).lean();

        return NextResponse.json({ active: active || null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
