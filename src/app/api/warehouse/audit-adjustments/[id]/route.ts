import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import AuditAdjustment from '@/models/AuditAdjustment';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        // Ensure User model is registered for Vercel cold starts
        void User;
        const { id } = await context.params;

        const adjustment = await AuditAdjustment.findById(id).lean() as any;

        if (!adjustment) {
            return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
        }

        // Manual hydration for SKU (handles String vs ObjectId mismatch)
        const skuRef = adjustment.sku?.toString();
        if (skuRef) {
            const db = mongoose.connection.db;
            if (db) {
                const lookupIds: any[] = [skuRef];
                if (mongoose.Types.ObjectId.isValid(skuRef)) {
                    lookupIds.push(new mongoose.Types.ObjectId(skuRef));
                }
                const skuDoc = await db.collection('skus').findOne(
                    { _id: { $in: lookupIds } },
                    { projection: { _id: 1, name: 1, uom: 1, image: 1, tier: 1 } }
                );
                if (skuDoc) {
                    adjustment.sku = { _id: skuDoc._id.toString(), name: skuDoc.name || '', uom: skuDoc.uom || '', image: skuDoc.image || '', tier: skuDoc.tier };
                }
            }
        }

        // Manual hydration for createdBy (email -> user details)
        const createdByRef = adjustment.createdBy?.toString();
        if (createdByRef) {
            const db = mongoose.connection.db;
            if (db) {
                const userDoc = await db.collection('rxhqusers').findOne(
                    { email: createdByRef },
                    { projection: { firstName: 1, lastName: 1 } }
                );
                if (userDoc) {
                    adjustment.createdBy = { firstName: userDoc.firstName || '', lastName: userDoc.lastName || '' };
                }
            }
        }

        return NextResponse.json({ adjustment });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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
