import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Notification from '@/models/Notification';

export const dynamic = 'force-dynamic';

// GET — Fetch notifications with optional category filter and unread count
export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const limit = parseInt(searchParams.get('limit') || '50');
        const page = parseInt(searchParams.get('page') || '1');

        const query: any = {};
        if (category) query.category = category;

        const [notifications, total, unreadCount, unreadByCategory] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Notification.countDocuments(query),
            Notification.countDocuments({ isRead: false }),
            Notification.aggregate([
                { $match: { isRead: false } },
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ])
        ]);

        const unreadMap: Record<string, number> = {};
        unreadByCategory.forEach((item: any) => {
            unreadMap[item._id] = item.count;
        });

        return NextResponse.json({
            notifications,
            total,
            unreadCount,
            unreadByCategory: unreadMap,
            page,
            hasMore: page * limit < total
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Create a notification
export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();

        // Support single or batch creation
        if (Array.isArray(body)) {
            const notifications = await Notification.insertMany(body);
            return NextResponse.json({ created: notifications.length });
        }

        const notification = await Notification.create(body);
        return NextResponse.json(notification);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
