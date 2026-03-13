import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import PurchaseOrder from '@/models/PurchaseOrder';

export const dynamic = 'force-dynamic';

// POST: Add a note
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();

        if (!body.note || !body.note.trim()) {
            return NextResponse.json({ error: 'Note text is required' }, { status: 400 });
        }

        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id || null;

        const order = await PurchaseOrder.findById(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        order.notes.push({
            note: body.note.trim(),
            createdBy: userId,
            createdAt: new Date(),
        });

        await order.save();

        // Re-fetch with populated createdBy
        const updated = await PurchaseOrder.findById(id)
            .select('notes')
            .populate('notes.createdBy', 'firstName lastName')
            .lean();

        return NextResponse.json({ notes: updated?.notes || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Edit a note
export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();

        if (!body.noteId) {
            return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
        }
        if (!body.note || !body.note.trim()) {
            return NextResponse.json({ error: 'Note text is required' }, { status: 400 });
        }

        const order = await PurchaseOrder.findById(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const noteEntry = order.notes.id(body.noteId);
        if (!noteEntry) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        noteEntry.note = body.note.trim();
        await order.save();

        const updated = await PurchaseOrder.findById(id)
            .select('notes')
            .populate('notes.createdBy', 'firstName lastName')
            .lean();

        return NextResponse.json({ notes: updated?.notes || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Remove a note
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);
        const noteId = searchParams.get('noteId');

        if (!noteId) {
            return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
        }

        const order = await PurchaseOrder.findById(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        order.notes.pull({ _id: noteId });
        await order.save();

        const updated = await PurchaseOrder.findById(id)
            .select('notes')
            .populate('notes.createdBy', 'firstName lastName')
            .lean();

        return NextResponse.json({ notes: updated?.notes || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
