import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Ticket from '@/models/Ticket';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        const ticket = await Ticket.findById(params.id);
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }
        return NextResponse.json(ticket);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        const body = await request.json();
        const updatedTicket = await Ticket.findByIdAndUpdate(
            params.id,
            { ...body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!updatedTicket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }
        return NextResponse.json(updatedTicket);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        const deletedTicket = await Ticket.findByIdAndDelete(params.id);
        if (!deletedTicket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Ticket deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
