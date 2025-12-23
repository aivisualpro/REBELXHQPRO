import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import AuditAdjustment from '@/models/AuditAdjustment';

export const dynamic = 'force-dynamic';

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();
        const { lotNumber, qty, reason } = body;

        const updatedAdjustment = await AuditAdjustment.findByIdAndUpdate(
            id,
            { 
                 lotNumber,
                 qty: parseFloat(qty),
                 reason,
                 // Typically we don't change SKU or CreatedBy on edit, but we could if needed. 
                 // Keeping it safe for now.
            },
            { new: true }
        ).populate('sku', 'name').lean();

        if (!updatedAdjustment) {
            return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
        }

        return NextResponse.json({ adjustment: updatedAdjustment });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;

        const deleted = await AuditAdjustment.findByIdAndDelete(id);

        if (!deleted) {
             return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
