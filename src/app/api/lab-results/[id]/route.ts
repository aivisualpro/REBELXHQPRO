import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import LabResult from '@/models/LabResult';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const labResult = await LabResult.findById(id);
        if (!labResult) {
            return NextResponse.json({ error: 'Lab result not found' }, { status: 404 });
        }
        return NextResponse.json(labResult);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();
        const updatedResult = await LabResult.findByIdAndUpdate(
            id,
            { ...body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!updatedResult) {
            return NextResponse.json({ error: 'Lab result not found' }, { status: 404 });
        }
        return NextResponse.json(updatedResult);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const deletedResult = await LabResult.findByIdAndDelete(id);
        if (!deletedResult) {
            return NextResponse.json({ error: 'Lab result not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Lab result deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
