import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';

// Clear all labor entries from all manufacturing orders
// Use: DELETE /api/manufacturing/clear-labor
export async function DELETE() {
    try {
        await dbConnect();
        
        // Clear the labor array from all manufacturing documents
        const result = await Manufacturing.updateMany(
            {},
            { $set: { labor: [] } }
        );

        return NextResponse.json({
            message: 'Labor data cleared',
            modifiedCount: result.modifiedCount
        });
    } catch (error: any) {
        console.error('Clear labor error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
