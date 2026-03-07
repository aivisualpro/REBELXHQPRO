import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import OrderEmail from '@/models/OrderEmail';

export const dynamic = 'force-dynamic';

// GET - Fetch unique recipient emails from past sent emails (for autocomplete memory)
export async function GET() {
    try {
        await dbConnect();

        // Aggregate unique "to" emails from all sent order emails
        const results = await OrderEmail.aggregate([
            { $unwind: '$to' },
            {
                $group: {
                    _id: '$to',
                    lastUsed: { $max: '$sentAt' },
                    count: { $sum: 1 },
                }
            },
            { $sort: { lastUsed: -1 } },
            { $limit: 100 },
        ]);

        const recipients = results.map((r: any) => ({
            email: r._id,
            lastUsed: r.lastUsed,
            count: r.count,
        }));

        return NextResponse.json({ recipients });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
