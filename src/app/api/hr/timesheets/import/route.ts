import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TimeSheet from '@/models/TimeSheet';
import User from '@/models/User';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!Array.isArray(data) || data.length === 0) {
            return NextResponse.json({ error: 'Invalid or empty data array' }, { status: 400 });
        }

        // Collect unique user emails from import data to lookup hourlyRates
        const emails = [...new Set(data.map((row: any) => (row.user || row.email || '').trim().toLowerCase()).filter(Boolean))];
        const users = await User.find({ email: { $in: emails } }).select('email hourlyRate').lean();
        const userMap = new Map(users.map((u: any) => [u.email.toLowerCase(), u.hourlyRate || 0]));

        const docs = data.map((row: any) => {
            const email = (row.user || row.email || '').trim().toLowerCase();
            const hourlyRate = row.hourlyRate
                ? parseFloat(row.hourlyRate.toString().replace(/[^0-9.]/g, ''))
                : (userMap.get(email) || 0);

            return {
                date: row.date ? new Date(row.date) : new Date(),
                user: email,
                hourlyRate: isNaN(hourlyRate) ? 0 : hourlyRate,
                timeIn: row.timeIn || '',
                timeOut: row.timeOut || '',
                createdBy: row.createdBy || '',
                createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
            };
        });

        const result = await TimeSheet.insertMany(docs, { ordered: false });

        return NextResponse.json({
            success: true,
            count: result.length,
            total: data.length,
        });
    } catch (error: any) {
        console.error('TimeSheet import error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
