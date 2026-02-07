import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import RetentionTask from '@/models/RetentionTask';
import Client from '@/models/Client';
import RXHQUsers from '@/models/User';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const status = searchParams.get('status'); // single status for per-column fetch
        const search = searchParams.get('search');
        const assignedTo = searchParams.get('assignedTo');
        const priority = searchParams.get('priority');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        // Always get aggregate counts (unfiltered by pagination)
        const statusCounts = await RetentionTask.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const countsMap: Record<string, number> = {};
        statusCounts.forEach((s: any) => {
            countsMap[s._id] = s.count;
        });

        // Build query for tasks
        let query: any = {};
        if (status) query.status = status;
        if (assignedTo) query.assignedTo = assignedTo;
        if (priority) query.priority = { $in: priority.split(',') };

        // If search, we need to find matching client IDs first
        if (search) {
            const matchingClients = await Client.find(
                { name: { $regex: search, $options: 'i' } },
                '_id'
            ).lean();
            const matchingClientIds = matchingClients.map((c: any) => c._id);
            query.client = { $in: matchingClientIds };
        }

        const [tasks, total] = await Promise.all([
            RetentionTask.find(query)
                .sort({ dueDate: 1, priority: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            RetentionTask.countDocuments(query)
        ]);

        // Get client and user info — filter to valid ObjectIds only
        const isValidObjectId = (id: any) => id && mongoose.Types.ObjectId.isValid(id.toString()) && id.toString().length === 24;
        const clientIds = [...new Set(tasks.map((t: any) => t.client).filter(isValidObjectId))];
        const userIds = [...new Set(tasks.map((t: any) => t.assignedTo).filter(isValidObjectId))];

        const [clients, users] = await Promise.all([
            clientIds.length > 0 ? Client.find({ _id: { $in: clientIds } }, '_id name phones emails').lean() : [],
            userIds.length > 0 ? RXHQUsers.find({ _id: { $in: userIds } }, '_id firstName lastName').lean() : []
        ]);

        const clientMap = new Map(clients.map((c: any) => [c._id.toString(), c]));
        const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

        const enrichedTasks = tasks.map((t: any) => ({
            ...t,
            clientInfo: clientMap.get(t.client?.toString()),
            assignedToInfo: userMap.get(t.assignedTo?.toString())
        }));

        return NextResponse.json({
            tasks: enrichedTasks,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            statusCounts: countsMap
        });
    } catch (error: any) {
        console.error('Retention tasks error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();

        const task = await RetentionTask.create(body);
        return NextResponse.json(task);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
