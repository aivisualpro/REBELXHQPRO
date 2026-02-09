import { NextRequest, NextResponse, after } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import mongoose from 'mongoose';
import { syncSkuToAppSheet } from '@/lib/appsheet';

export const dynamic = 'force-dynamic';

// SKU _id can be stored as either String or ObjectId (due to BSON type drift from imports).
// We must try both query types to ensure we always find the document.
async function findSkuById(id: string) {
    // Try as String first (newer records)
    let sku = await Sku.findOne({ _id: id });
    // Fallback to ObjectId (older/imported records)
    if (!sku && mongoose.Types.ObjectId.isValid(id)) {
        const db = mongoose.connection.db!;
        const raw = await db.collection('skus').findOne({ _id: new mongoose.Types.ObjectId(id) });
        if (raw) {
            // Return as Mongoose document by wrapping
            sku = new Sku(raw);
            sku.isNew = false;
        }
    }
    return sku;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const sku = await findSkuById(id);

        if (!sku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        return NextResponse.json(sku);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();

        // Try as String _id first
        let updatedSku = await Sku.findOneAndUpdate(
            { _id: id },
            { $set: { ...body, updatedAt: new Date() } },
            { new: true, runValidators: true }
        );

        // Fallback: try as ObjectId via native driver, then update
        if (!updatedSku && mongoose.Types.ObjectId.isValid(id)) {
            const db = mongoose.connection.db!;
            const result = await db.collection('skus').findOneAndUpdate(
                { _id: new mongoose.Types.ObjectId(id) },
                { $set: { ...body, updatedAt: new Date() } },
                { returnDocument: 'after' }
            );
            if (result) {
                updatedSku = new Sku(result) as any;
            }
        }

        if (!updatedSku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        // Sync to AppSheet in background
        after(async () => {
            try {
                await syncSkuToAppSheet(updatedSku, 'Edit');
                console.log('✅ SKU synced to AppSheet:', id);
            } catch (syncError) {
                console.error('❌ Background AppSheet SKU sync failed:', syncError);
            }
        });

        return NextResponse.json(updatedSku);
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

        // Try as String first
        let deletedSku = await Sku.findOneAndDelete({ _id: id });

        // Fallback: try as ObjectId via native driver
        if (!deletedSku && mongoose.Types.ObjectId.isValid(id)) {
            const db = mongoose.connection.db!;
            const raw = await db.collection('skus').findOneAndDelete(
                { _id: new mongoose.Types.ObjectId(id) }
            );
            if (raw) {
                deletedSku = new Sku(raw) as any;
            }
        }

        if (!deletedSku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        // Sync deletion to AppSheet in background
        after(async () => {
            try {
                await syncSkuToAppSheet(deletedSku, 'Delete');
                console.log('✅ SKU deletion synced to AppSheet:', id);
            } catch (syncError) {
                console.error('❌ Background AppSheet SKU delete sync failed:', syncError);
            }
        });

        return NextResponse.json({ message: 'SKU deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
