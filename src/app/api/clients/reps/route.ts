import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        
        // Find all unique sales reps assigned to clients
        const repIds = await Client.distinct('salesPerson');
        const validIds = repIds.filter(id => id && typeof id === 'string');
        
        // Fetch the user details for those valid IDs
        const reps = await User.find(
            { _id: { $in: validIds }, status: 'Active' },
            'firstName lastName email'
        ).sort({ firstName: 1 }).lean();

        return NextResponse.json({ reps });
    } catch (error: any) {
        console.error('Error fetching client reps:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
