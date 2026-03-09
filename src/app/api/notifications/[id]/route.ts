import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Notification from '@/models/Notification';

export const dynamic = 'force-dynamic';

// PATCH — Mark a single notification as read
export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;

        const notification = await Notification.findByIdAndUpdate(
            id,
            { $set: { isRead: true } },
            { new: true }
        );

        if (!notification) {
            return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
        }

        return NextResponse.json(notification);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — Delete a notification
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        await Notification.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
