import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        
        // Find by native _id or external legacyId
        const query = mongoose.isValidObjectId(id) 
            ? { $or: [{ _id: id }, { legacyId: id }] }
            : { legacyId: id };
            
        const client = await Client.findOne(query);
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }
        return NextResponse.json(client);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();

        // Find by native _id or external legacyId
        const query = mongoose.isValidObjectId(id) 
            ? { $or: [{ _id: id }, { legacyId: id }] }
            : { legacyId: id };

        // Handle notes if it's a string (from UI edit modal)
        if (typeof body.notes === 'string') {
            if (body.notes.trim()) {
                body.notes = [{ note: body.notes.trim() }];
            } else {
                body.notes = [];
            }
        }

        const client = await Client.findOneAndUpdate(query, body, { new: true });
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }
        return NextResponse.json(client);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const query = mongoose.isValidObjectId(id) 
            ? { $or: [{ _id: id }, { legacyId: id }] }
            : { legacyId: id };
            
        const client = await Client.findOneAndDelete(query);
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Client deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
