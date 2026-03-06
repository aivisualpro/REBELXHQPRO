import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Workspace from '@/models/Workspace';

export const dynamic = 'force-dynamic';

// GET single workspace
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const workspace = await Workspace.findById(id).lean();
        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }
        return NextResponse.json({ data: workspace });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT update workspace
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const { name, description, color, modules, isDefault } = body;

        // If setting as default, unset others
        if (isDefault) {
            await Workspace.updateMany({ _id: { $ne: id } }, { isDefault: false });
        }

        const workspace = await Workspace.findByIdAndUpdate(
            id,
            {
                ...(name !== undefined && { name: name.trim() }),
                ...(description !== undefined && { description }),
                ...(color !== undefined && { color }),
                ...(modules !== undefined && { modules }),
                ...(isDefault !== undefined && { isDefault }),
            },
            { new: true }
        ).lean();

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        return NextResponse.json({ data: workspace });
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json({ error: 'A workspace with this name already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE workspace
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const workspace = await Workspace.findByIdAndDelete(id);
        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
