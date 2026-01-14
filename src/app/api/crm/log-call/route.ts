import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Activity from '@/models/Activity';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { clientId, phoneNumber, duration, type = 'Call', notes } = body;

        if (!clientId || !phoneNumber) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Build comment string
        let commentText = `${type} to ${phoneNumber}`;
        if (duration) commentText += ` (${duration})`;
        if (notes) commentText += ` - ${notes}`;

        // Create activity with Google Voice link
        const activity = await Activity.create({
            type,
            client: clientId,
            comments: commentText,
            metadata: {
                phoneNumber,
                duration,
                googleVoiceLink: `https://voice.google.com/u/0/calls?number=${phoneNumber.replace(/\D/g, '')}`
            },
            createdBy: (session.user as any).id,
            createdAt: new Date()
        });

        return NextResponse.json({ success: true, activity });

    } catch (error: any) {
        console.error('Manual call log error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
