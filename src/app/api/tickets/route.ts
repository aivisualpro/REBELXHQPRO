import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Ticket from '@/models/Ticket';
import User from '@/models/User';
import { applyDateFilter } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limitParam = searchParams.get('limit');
        const limit = limitParam === '0' ? 0 : parseInt(limitParam || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
        const search = searchParams.get('search') || '';

        let query: any = {};

        // Apply Global Date Filter
        query = await applyDateFilter(query, 'createdAt');

        if (search) {
            query.$or = [
                { issue: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                // searching by requestedBy ID might still work if it's a string ID. 
                // searching by requestedBy NAME is harder with populate, usually requires aggregate or separate lookup.
                // For now, removing requestedBy regex search or assuming it searches the ID string in the doc.
                { _id: { $regex: search, $options: 'i' } }
            ];

            // If search looks like a name, we might want to find users first? 
            // For simplicity, let's keep it simple for now or use the 'imported' name string if it was that.
        }

        const queryObj = Ticket.find(query)
            .populate('requestedBy', 'firstName lastName profileImage')
            .populate('completedBy', 'firstName lastName')
            .sort({ [sortBy]: sortOrder as any });

        if (limit > 0) {
            queryObj.skip((page - 1) * limit).limit(limit);
        }

        const [total, tickets] = await Promise.all([
            Ticket.countDocuments(query),
            queryObj.lean()
        ]);

        return NextResponse.json({
            tickets,
            total,
            page,
            totalPages: limit > 0 ? Math.ceil(total / limit) : 1
        });
    } catch (error: any) {
        console.error('GET /tickets Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const newItem = await Ticket.create(body);
        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
