import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { users } = await request.json();

        if (!Array.isArray(users)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const operations = users.map(row => {
            const hourlyRate = row.hourlyRate ? parseFloat(row.hourlyRate.toString().replace(/[^0-9.]/g, '')) : 0;

            return {
                updateOne: {
                    filter: { email: row.email }, // Use email as filter
                    update: {
                        $set: {
                            _id: row.email, // Ensure _id is set to email for consistency with original logic
                            firstName: row.firstName,
                            lastName: row.lastName,
                            role: row.role,
                            department: row.department,
                            password: row.password || '123456',
                            phone: row.phone,
                            hourlyRate: isNaN(hourlyRate) ? 0 : hourlyRate,
                            status: row.status ? (row.status.charAt(0).toUpperCase() + row.status.slice(1).toLowerCase()) : 'Active',
                            profileImage: row.profileImage || '',
                        }
                    },
                    upsert: true
                }
            };
        });

        const result = await User.bulkWrite(operations);

        return NextResponse.json({
            success: true,
            imported: result.upsertedCount + result.modifiedCount,
            total: users.length
        });
    } catch (error: any) {
        console.error('Import error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
