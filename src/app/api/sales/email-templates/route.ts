import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import EmailTemplate from '@/models/EmailTemplate';

export const dynamic = 'force-dynamic';

// GET - Fetch all templates
export async function GET() {
    try {
        await dbConnect();
        const templates = await EmailTemplate.find().sort({ updatedAt: -1 }).lean();
        return NextResponse.json({ templates });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create a new template
export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();
        const { name, subject, body: templateBody, createdBy } = body;

        if (!name || !templateBody) {
            return NextResponse.json({ error: 'Name and body are required' }, { status: 400 });
        }

        const template = await EmailTemplate.create({
            name: name.trim(),
            subject: subject || '',
            body: templateBody,
            createdBy,
        });

        return NextResponse.json({ success: true, template });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE - Delete a template
export async function DELETE(request: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
        }

        await EmailTemplate.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
