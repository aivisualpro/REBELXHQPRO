import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import OpeningBalance from '@/models/OpeningBalance';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;

        const item = await OpeningBalance.findById(id).lean();

        if (!item) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        // Manual SKU population using raw driver for cross-type matching
        if (item.sku) {
            try {
                const skuIdStr = item.sku.toString();
                const lookupIds: any[] = [skuIdStr];
                const mongoose = await import('mongoose');
                if (mongoose.default.Types.ObjectId.isValid(skuIdStr)) {
                    lookupIds.push(new mongoose.default.Types.ObjectId(skuIdStr));
                }
                const db = mongoose.default.connection.db;
                if (db) {
                    const skuDoc = await db.collection('skus').findOne(
                        { _id: { $in: lookupIds } }
                    );
                    if (skuDoc) {
                        (item as any).sku = { _id: skuDoc._id.toString(), name: skuDoc.name || '', image: skuDoc.image || '', category: skuDoc.category || '' };
                    }
                }
            } catch (e) {
                // Leave sku as-is if lookup fails
            }
        }

        return NextResponse.json(item);
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

        const updatedItem = await OpeningBalance.findByIdAndUpdate(
            id,
            body,
            { new: true, runValidators: true }
        ).populate('sku');

        if (!updatedItem) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        // Propagate cost change if applicable
        if (updatedItem.lotNumber && updatedItem.cost !== undefined) {
            const { propagateCostChange } = await import('@/lib/cost-propagation');
            const skuId = (typeof updatedItem.sku === 'object' && updatedItem.sku?._id) ? updatedItem.sku._id : updatedItem.sku;
            await propagateCostChange(skuId, updatedItem.lotNumber, updatedItem.cost);
        }

        return NextResponse.json(updatedItem);
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

        const deletedItem = await OpeningBalance.findByIdAndDelete(id);

        if (!deletedItem) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Item deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
