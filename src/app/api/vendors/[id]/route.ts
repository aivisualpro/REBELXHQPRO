import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Vendor from '@/models/Vendor';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const vendor = await Vendor.findById(id).lean();
        if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
        return NextResponse.json(vendor);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const updated = await Vendor.findByIdAndUpdate(id, body, { new: true });
        if (!updated) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const deleted = await Vendor.findByIdAndDelete(id);
        if (!deleted) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
        return NextResponse.json({ message: 'Vendor deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
