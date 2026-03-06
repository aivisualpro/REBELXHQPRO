import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Workspace from '@/models/Workspace';

export const dynamic = 'force-dynamic';

// GET all workspaces
export async function GET() {
    try {
        await dbConnect();
        const workspaces = await Workspace.find({}).sort({ createdAt: -1 }).lean();
        return NextResponse.json({ data: workspaces });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST create a new workspace
export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();

        const { name, description, color, modules, isDefault } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
        }

        // Check for duplicate name
        const existing = await Workspace.findOne({ name: name.trim() });
        if (existing) {
            return NextResponse.json({ error: 'A workspace with this name already exists' }, { status: 409 });
        }

        // If this is default, unset other defaults
        if (isDefault) {
            await Workspace.updateMany({}, { isDefault: false });
        }

        const workspace = await Workspace.create({
            name: name.trim(),
            description: description || '',
            color: color || '#f2b61c',
            modules: modules || [],
            isDefault: isDefault || false,
        });

        return NextResponse.json({ data: workspace }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
