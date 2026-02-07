import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// Helper: find SKU by _id regardless of whether stored as ObjectId or String
async function findSkuById(id: string) {
    // Try as ObjectId first, then as string
    let sku = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
        sku = await Sku.findById(id);
    }
    if (!sku) {
        sku = await Sku.findOne({ _id: id });
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

        let updatedSku = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            updatedSku = await Sku.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true });
        }
        if (!updatedSku) {
            updatedSku = await Sku.findOneAndUpdate({ _id: id }, { $set: body }, { new: true, runValidators: true });
        }

        if (!updatedSku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

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

        let deletedSku = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            deletedSku = await Sku.findByIdAndDelete(id);
        }
        if (!deletedSku) {
            deletedSku = await Sku.findOneAndDelete({ _id: id });
        }

        if (!deletedSku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'SKU deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
