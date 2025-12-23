import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Setting from '@/models/Setting';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const settings = await Setting.find({});
        // Convert to key-value object for easier frontend consumption
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, any>);
        
        return NextResponse.json(settingsMap);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        
        // Body should be an object of key-values to update
        const updates = Object.entries(body).map(([key, value]) => {
            return Setting.findOneAndUpdate(
                { key },
                { key, value, updatedAt: new Date() },
                { upsert: true, new: true }
            );
        });

        await Promise.all(updates);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
