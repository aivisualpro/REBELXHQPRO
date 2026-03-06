import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';

export const dynamic = 'force-dynamic';

// Bulk update specific fields on multiple orders at once
export async function PATCH(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { updates } = body;

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        // Only allow specific fields to be updated via bulk
        const ALLOWED_FIELDS = ['shippingCost', 'discount', 'tax'];

        const operations = updates.map((update: { _id: string;[key: string]: any }) => {
            const setFields: any = {};
            for (const field of ALLOWED_FIELDS) {
                if (update[field] !== undefined) {
                    setFields[field] = Number(update[field]) || 0;
                }
            }

            return {
                updateOne: {
                    filter: { _id: update._id },
                    update: { $set: setFields }
                }
            };
        });

        const result = await SaleOrder.bulkWrite(operations, { ordered: false });
        const count = result.modifiedCount || 0;

        return NextResponse.json({
            success: true,
            count,
            message: `Updated ${count} order${count !== 1 ? 's' : ''}`
        });
    } catch (error: any) {
        console.error('Bulk update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
