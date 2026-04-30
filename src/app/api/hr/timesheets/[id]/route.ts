import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TimeSheet from '@/models/TimeSheet';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const entry = await TimeSheet.findById(id).lean();
        if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(entry);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const updated = await TimeSheet.findByIdAndUpdate(id, body, { new: true }).lean();
        if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const deleted = await TimeSheet.findByIdAndDelete(id);
        if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
