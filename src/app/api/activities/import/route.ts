import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Activity from '@/models/Activity';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { activities } = body;

        if (!Array.isArray(activities)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const validActivities = activities.map((item: any) => ({
            type: item.type,
            client: item.client,
            comments: item.comments,
            createdBy: item.createdBy,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
        }));

        if (validActivities.length > 0) {
            await Activity.insertMany(validActivities);
        }

        return NextResponse.json({ message: 'Import completed', count: validActivities.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
