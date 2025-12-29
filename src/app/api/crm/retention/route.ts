import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import RetentionTask from '@/models/RetentionTask';
import Client from '@/models/Client';
import SaleOrder from '@/models/SaleOrder';
import Activity from '@/models/Activity';
import RXHQUsers from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const status = searchParams.get('status');
        const assignedTo = searchParams.get('assignedTo');
        const priority = searchParams.get('priority');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        let query: any = {};
        if (status) query.status = { $in: status.split(',') };
        if (assignedTo) query.assignedTo = assignedTo;
        if (priority) query.priority = { $in: priority.split(',') };

        const [tasks, total] = await Promise.all([
            RetentionTask.find(query)
                .sort({ dueDate: 1, priority: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            RetentionTask.countDocuments(query)
        ]);

        // Get client and user info
        const clientIds = [...new Set(tasks.map((t: any) => t.client))];
        const userIds = [...new Set(tasks.map((t: any) => t.assignedTo).filter(Boolean))];

        const [clients, users] = await Promise.all([
            Client.find({ _id: { $in: clientIds } }, '_id name phones emails').lean(),
            RXHQUsers.find({ _id: { $in: userIds } }, '_id firstName lastName').lean()
        ]);

        const clientMap = new Map(clients.map((c: any) => [c._id.toString(), c]));
        const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

        const enrichedTasks = tasks.map((t: any) => ({
            ...t,
            clientInfo: clientMap.get(t.client?.toString()),
            assignedToInfo: userMap.get(t.assignedTo?.toString())
        }));

        // Get stats
        const stats = await RetentionTask.aggregate([
            { $group: {
                _id: '$status',
                count: { $sum: 1 }
            }}
        ]);

        const overdueTasks = await RetentionTask.countDocuments({
            status: { $in: ['Pending', 'In Progress'] },
            dueDate: { $lt: new Date() }
        });

        return NextResponse.json({
            tasks: enrichedTasks,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            stats: {
                byStatus: stats,
                overdue: overdueTasks
            }
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
