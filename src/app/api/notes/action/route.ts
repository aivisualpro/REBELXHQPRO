import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { clientId, note, noteId } = body;

        if (!clientId || !note) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (noteId) {
            // Update existing note
            await Client.updateOne(
                { _id: clientId, "notes._id": noteId },
                { 
                    $set: { 
                        "notes.$.note": note,
                        // Optionally update createdBy or timestamp if needed, but usually we keep original creator
                    } 
                }
            );
        } else {
            // Create new note
            await Client.findByIdAndUpdate(clientId, {
                $push: {
                    notes: {
                        note,
                        createdBy: session.user.id, // Storing ID for now, will map to name on fetch
                        createdAt: new Date()
                    }
                }
            });
        }

        return NextResponse.json({ success: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("Save Note Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');
        const noteId = searchParams.get('noteId');

        if (!clientId || !noteId) {
            return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
        }

        await Client.findByIdAndUpdate(clientId, {
            $pull: { notes: { _id: noteId } }
        });

        return NextResponse.json({ success: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
