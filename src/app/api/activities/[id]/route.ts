import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Activity from '@/models/Activity';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const activity = await Activity.findById(id).populate('client').populate('createdBy');

        if (!activity) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
        }

        return NextResponse.json(activity);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        // Prevent updating _id or immutable fields if any
        // For now, allow updating standard fields
        const updatedActivity = await Activity.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true, runValidators: true }
        );

        if (!updatedActivity) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
        }

        return NextResponse.json(updatedActivity);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const deletedActivity = await Activity.findByIdAndDelete(id);

        if (!deletedActivity) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Activity deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
