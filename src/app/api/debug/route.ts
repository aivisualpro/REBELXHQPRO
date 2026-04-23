import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import mongoose from 'mongoose';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'No db' });

    const globalStartDate = await getGlobalStartDate();
    const obsStr = await db.collection('openingbalances').find({ sku: "6986986cf21918a2f3e29415" }).toArray();
    const obsObj = await db.collection('openingbalances').find({ sku: new mongoose.Types.ObjectId("6986986cf21918a2f3e29415") }).toArray();
    const all = await db.collection('openingbalances').find({ lotNumber: "07/11/25" }).toArray();

    return NextResponse.json({
        globalStartDate,
        obsStr,
        obsObj,
        all
    });
}
