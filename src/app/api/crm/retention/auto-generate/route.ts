import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import RetentionTask from '@/models/RetentionTask';
import Client from '@/models/Client';
import SaleOrder from '@/models/SaleOrder';
import Activity from '@/models/Activity';
import RXHQUsers from '@/models/User';

export const dynamic = 'force-dynamic';

// Generate intelligent, personalized notes based on context
function generateIntelligentNotes(params: {
    clientName: string;
    salesRepName: string | null;
    daysSince: number;
    taskType: 'Check-in' | 'Re-engagement' | 'Win-back';
    lastOrderAmount?: number;
    totalOrders?: number;
    totalRevenue?: number;
}): string {
    const { clientName, salesRepName, daysSince, taskType, lastOrderAmount, totalOrders, totalRevenue } = params;

    const repGreeting = salesRepName ? `Hi ${salesRepName.split(' ')[0]}, ` : '';
    const revenueContext = totalRevenue && totalRevenue > 0 
        ? `This client has generated $${totalRevenue.toLocaleString()} in lifetime revenue with ${totalOrders || 0} orders. `
        : '';
    const lastOrderContext = lastOrderAmount && lastOrderAmount > 0
        ? `Their last order was worth $${lastOrderAmount.toLocaleString()}. `
        : '';

    // Different note templates based on task type and context
    const checkInTemplates = [
        `${repGreeting}${clientName} hasn't placed an order in ${daysSince} days. ${revenueContext}Time for a friendly check-in to see if they need anything or have questions about our products.`,
        `${repGreeting}It's been ${daysSince} days since ${clientName}'s last activity. ${lastOrderContext}Consider reaching out to maintain the relationship and gather feedback on their experience.`,
        `${repGreeting}${clientName} may need a gentle nudge - ${daysSince} days since last interaction. ${revenueContext}A quick call could help uncover new opportunities or address any concerns.`,
    ];

    const reEngagementTemplates = [
        `${repGreeting}⚠️ ATTENTION: ${clientName} has been silent for ${daysSince} days. ${revenueContext}This is a critical window - reach out with a personalized offer or exclusive deal before they drift further.`,
        `${repGreeting}${clientName} is showing signs of disengagement (${daysSince} days inactive). ${lastOrderContext}Consider offering a loyalty discount or sharing new product launches to re-spark interest.`,
        `${repGreeting}We need to act on ${clientName} - they've been inactive for ${daysSince} days. ${revenueContext}Schedule a call to understand their current needs and address any issues they might have.`,
    ];

    const winBackTemplates = [
        `${repGreeting}🚨 HIGH PRIORITY: ${clientName} is at serious churn risk (${daysSince} days inactive). ${revenueContext}Immediate action required - consider a win-back campaign with special pricing or a personal outreach from leadership.`,
        `${repGreeting}${clientName} hasn't engaged in ${daysSince} days and may be lost without intervention. ${lastOrderContext}Reach out to understand what went wrong and what we can do to earn back their business.`,
        `${repGreeting}URGENT: ${clientName} requires immediate attention. ${daysSince}+ days of inactivity signals potential loss. ${revenueContext}Prepare a compelling win-back offer and schedule a priority call today.`,
        `${repGreeting}${clientName} has been dormant for ${daysSince} days. ${revenueContext}This was a valuable account. Consider reaching out with an exclusive return offer or ask if there were any service issues we need to address.`,
    ];

    // Select template based on task type
    let templates: string[];
    switch (taskType) {
        case 'Check-in':
            templates = checkInTemplates;
            break;
        case 'Re-engagement':
            templates = reEngagementTemplates;
            break;
        case 'Win-back':
            templates = winBackTemplates;
            break;
        default:
            templates = checkInTemplates;
    }

    // Randomly select a template for variety
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
}

// Auto-generate retention tasks based on client inactivity
// Intelligently assigns tasks to the client's sales rep
export async function POST(request: NextRequest) {
    try {
        await dbConnect();

        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        // Get all clients who have at least one wholesale order
        const wholesaleClientIds = await SaleOrder.distinct('clientId', { orderStatus: { $ne: 'Cancelled' } });

        // Get client info including sales rep assignments
        const clientsWithReps = await Client.find(
            { _id: { $in: wholesaleClientIds } },
            '_id name salesPerson'
        ).lean();

        const clientInfoMap = new Map<string, { name: string; salesPerson: string | null }>();
        clientsWithReps.forEach((c: any) => {
            clientInfoMap.set(c._id.toString(), { 
                name: c.name || 'Unknown Client', 
                salesPerson: c.salesPerson || null 
            });
        });

        // Get sales rep names
        const salesRepIds = [...new Set(clientsWithReps.map((c: any) => c.salesPerson).filter(Boolean))];
        const salesReps = await RXHQUsers.find({ _id: { $in: salesRepIds } }, '_id firstName lastName').lean();
        const salesRepMap = new Map<string, string>();
        salesReps.forEach((sr: any) => {
            salesRepMap.set(sr._id.toString(), `${sr.firstName || ''} ${sr.lastName || ''}`.trim());
        });

        // Get order stats per client
        const orderStats = await SaleOrder.aggregate([
            { $match: { clientId: { $in: wholesaleClientIds }, orderStatus: { $ne: 'Cancelled' } } },
            { $unwind: { path: '$lineItems', preserveNullAndEmptyArrays: true } },
            { $group: {
                _id: '$clientId',
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: { $ifNull: ['$lineItems.total', 0] } },
                lastOrderAmount: { $last: { $ifNull: ['$lineItems.total', 0] } }
            }}
        ]);

        const orderStatsMap = new Map<string, { totalOrders: number; totalRevenue: number; lastOrderAmount: number }>();
        orderStats.forEach((os: any) => {
            if (os._id) {
                orderStatsMap.set(os._id.toString(), {
                    totalOrders: os.totalOrders || 0,
                    totalRevenue: os.totalRevenue || 0,
                    lastOrderAmount: os.lastOrderAmount || 0
                });
            }
        });

        // Get last order and activity dates for each client
        const [lastOrderGroups, lastActivityGroups] = await Promise.all([
            SaleOrder.aggregate([
                { $match: { clientId: { $in: wholesaleClientIds }, orderStatus: { $ne: 'Cancelled' } } },
                { $group: { _id: '$clientId', lastDate: { $max: '$createdAt' } } }
            ]),
            Activity.aggregate([
                { $match: { client: { $in: wholesaleClientIds.map(String) } } },
                { $group: { _id: '$client', lastDate: { $max: '$createdAt' } } }
            ])
        ]);

        const interactionMap = new Map<string, Date>();
        lastOrderGroups.forEach((g: any) => {
            if (g._id) {
                const id = g._id.toString();
                const current = interactionMap.get(id);
                if (!current || new Date(g.lastDate) > current) {
                    interactionMap.set(id, new Date(g.lastDate));
                }
            }
        });
        lastActivityGroups.forEach((g: any) => {
            if (g._id) {
                const id = g._id.toString();
                const current = interactionMap.get(id);
                if (!current || new Date(g.lastDate) > current) {
                    interactionMap.set(id, new Date(g.lastDate));
                }
            }
        });

        // Get existing pending/in-progress tasks to avoid duplicates
        const existingTasks = await RetentionTask.find({
            status: { $in: ['To Do', 'In Progress', 'In Review'] }
        }, 'client triggerReason').lean();

        const existingTaskSet = new Set(
            existingTasks.map((t: any) => `${t.client}-${t.triggerReason}`)
        );

        const tasksToCreate: any[] = [];

        for (const clientId of wholesaleClientIds) {
            const id = clientId.toString();
            const lastInteraction = interactionMap.get(id);
            const clientInfo = clientInfoMap.get(id);
            const salesRepId = clientInfo?.salesPerson;
            const salesRepName = salesRepId ? salesRepMap.get(salesRepId) || null : null;
            const stats = orderStatsMap.get(id);

            if (!lastInteraction) continue;

            const daysSince = Math.floor((now - lastInteraction.getTime()) / dayMs);

            // 30-60 days: Check-in call
            if (daysSince > 30 && daysSince <= 60) {
                const key = `${id}-30 days inactive`;
                if (!existingTaskSet.has(key)) {
                    tasksToCreate.push({
                        client: id,
                        type: 'Check-in',
                        priority: 'Medium',
                        dueDate: new Date(now + 3 * dayMs),
                        assignedTo: salesRepId,
                        autoGenerated: true,
                        triggerReason: '30 days inactive',
                        notes: generateIntelligentNotes({
                            clientName: clientInfo?.name || 'Unknown Client',
                            salesRepName,
                            daysSince,
                            taskType: 'Check-in',
                            totalOrders: stats?.totalOrders,
                            totalRevenue: stats?.totalRevenue,
                            lastOrderAmount: stats?.lastOrderAmount
                        })
                    });
                }
            }

            // 60-90 days: Re-engagement
            if (daysSince > 60 && daysSince <= 90) {
                const key = `${id}-60 days inactive`;
                if (!existingTaskSet.has(key)) {
                    tasksToCreate.push({
                        client: id,
                        type: 'Re-engagement',
                        priority: 'High',
                        dueDate: new Date(now + 2 * dayMs),
                        assignedTo: salesRepId,
                        autoGenerated: true,
                        triggerReason: '60 days inactive',
                        notes: generateIntelligentNotes({
                            clientName: clientInfo?.name || 'Unknown Client',
                            salesRepName,
                            daysSince,
                            taskType: 'Re-engagement',
                            totalOrders: stats?.totalOrders,
                            totalRevenue: stats?.totalRevenue,
                            lastOrderAmount: stats?.lastOrderAmount
                        })
                    });
                }
            }

            // 90+ days: Win-back
            if (daysSince > 90) {
                const key = `${id}-90 days inactive`;
                if (!existingTaskSet.has(key)) {
                    tasksToCreate.push({
                        client: id,
                        type: 'Win-back',
                        priority: 'Critical',
                        dueDate: new Date(now + 1 * dayMs),
                        assignedTo: salesRepId,
                        autoGenerated: true,
                        triggerReason: '90 days inactive',
                        notes: generateIntelligentNotes({
                            clientName: clientInfo?.name || 'Unknown Client',
                            salesRepName,
                            daysSince,
                            taskType: 'Win-back',
                            totalOrders: stats?.totalOrders,
                            totalRevenue: stats?.totalRevenue,
                            lastOrderAmount: stats?.lastOrderAmount
                        })
                    });
                }
            }
        }

        // Bulk insert new tasks
        let createdCount = 0;
        let assignedCount = 0;
        if (tasksToCreate.length > 0) {
            const result = await RetentionTask.insertMany(tasksToCreate);
            createdCount = result.length;
            assignedCount = tasksToCreate.filter(t => t.assignedTo).length;
        }

        // Update overdue tasks
        const overdueResult = await RetentionTask.updateMany(
            { 
                status: { $in: ['To Do', 'In Progress', 'In Review'] },
                dueDate: { $lt: new Date() }
            },
            { $set: { updatedAt: new Date() } }
        );

        return NextResponse.json({
            message: 'Auto-generation complete',
            tasksCreated: createdCount,
            tasksAssigned: assignedCount,
            tasksMarkedOverdue: overdueResult.modifiedCount
        });
    } catch (error: any) {
        console.error('Auto-generate error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
