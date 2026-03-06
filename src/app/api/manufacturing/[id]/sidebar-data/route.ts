import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import mongoose from 'mongoose';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manufacturing/[id]/sidebar-data
 * 
 * Single endpoint that returns all deferred sidebar data in ONE call:
 *   - Users list (for labor dropdown + name lookups)
 *   - SKU list (for add line-item dropdown)
 *   - Global settings (for fallback images)
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        void User;

        const db = mongoose.connection.db;
        if (!db) {
            return NextResponse.json({ error: 'No DB' }, { status: 500 });
        }

        // Fetch all 3 in parallel — single round-trip from the browser
        const [users, skus, settingsArr] = await Promise.all([
            // Users: minimal fields for labor dropdown + name lookups
            User.find({})
                .select('_id firstName lastName email hourlyRate')
                .lean(),

            // SKUs: _id, name, category, image for line-item dropdown
            db.collection('skus').find(
                {},
                { projection: { _id: 1, name: 1, category: 1, image: 1 } }
            ).sort({ name: 1 }).toArray(),

            // Global settings
            db.collection('settings').find({}).limit(1).toArray()
        ]);

        const allUsers = users.map((u: any) => ({
            _id: u._id.toString(),
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            email: u.email,
            hourlyRate: u.hourlyRate
        }));

        return NextResponse.json({
            users: allUsers,
            skus: skus.map((s: any) => ({
                _id: s._id.toString(),
                name: s.name,
                category: s.category,
                image: s.image
            })),
            settings: settingsArr[0] || null
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
