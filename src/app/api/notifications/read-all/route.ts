import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Notification from '@/models/Notification';

export const dynamic = 'force-dynamic';

// PATCH — Mark all notifications as read (optionally by category)
export async function PATCH(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json().catch(() => ({}));
        const query: any = { isRead: false };
        if (body.category) query.category = body.category;

        const result = await Notification.updateMany(query, { $set: { isRead: true } });
        return NextResponse.json({ updated: result.modifiedCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
