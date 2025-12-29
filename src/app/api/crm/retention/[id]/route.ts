import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import RetentionTask from '@/models/RetentionTask';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();

        // If completing task, set completedAt
        if (body.status === 'Completed' && !body.completedAt) {
            body.completedAt = new Date();
        }

        body.updatedAt = new Date();

        const task = await RetentionTask.findByIdAndUpdate(id, body, { new: true });
        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json(task);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;

        const task = await RetentionTask.findByIdAndDelete(id);
        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Task deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
