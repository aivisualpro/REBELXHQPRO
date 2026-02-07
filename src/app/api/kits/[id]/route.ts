import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Kit } from '@/models/Kit';
import Sku from '@/models/Sku';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        void Sku;
        void User;

        const kit = await Kit.findById(id)
            .populate('lineItems.sku', 'name')
            .populate('createdBy', 'firstName lastName')
            .lean();

        if (!kit) {
            return NextResponse.json({ error: 'Kit not found' }, { status: 404 });
        }

        return NextResponse.json(kit);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();
        const updatedKit = await Kit.findByIdAndUpdate(id, body, { new: true })
            .populate('lineItems.sku', 'name')
            .populate('createdBy', 'firstName lastName');

        if (!updatedKit) {
            return NextResponse.json({ error: 'Kit not found' }, { status: 404 });
        }

        return NextResponse.json(updatedKit);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const deletedKit = await Kit.findByIdAndDelete(id);

        if (!deletedKit) {
            return NextResponse.json({ error: 'Kit not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Kit deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
