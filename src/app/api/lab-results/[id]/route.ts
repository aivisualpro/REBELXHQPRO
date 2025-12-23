import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import LabResult from '@/models/LabResult';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        const labResult = await LabResult.findById(params.id);
        if (!labResult) {
            return NextResponse.json({ error: 'Lab result not found' }, { status: 404 });
        }
        return NextResponse.json(labResult);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        const body = await request.json();
        const updatedResult = await LabResult.findByIdAndUpdate(
            params.id,
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        const deletedResult = await LabResult.findByIdAndDelete(params.id);
        if (!deletedResult) {
            return NextResponse.json({ error: 'Lab result not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Lab result deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
