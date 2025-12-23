import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import AuditAdjustment from '@/models/AuditAdjustment';

export const dynamic = 'force-dynamic';

export async function GET() {
    await dbConnect();
    try {
        const count = await AuditAdjustment.countDocuments({});
        const sample = await AuditAdjustment.findOne({}).lean();
        return NextResponse.json({ count, sample });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
