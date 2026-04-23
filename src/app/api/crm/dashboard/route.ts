import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import Activity from '@/models/Activity';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');
        const salesRep = searchParams.get('salesRep');

        // Time boundaries
        const now = new Date();
        const startOfMonth = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = endDateStr ? new Date(endDateStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const startOfLastMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - 1, 1);
        
        // Match conditions
        const clientMatch: any = {};
        if (salesRep && salesRep !== 'All') {
            clientMatch.salesPerson = salesRep;
        }
        
        const activityMatch: any = {
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        };
        const prevActivityMatch: any = {
            createdAt: { $gte: startOfLastMonth, $lt: startOfMonth }
        };
        if (salesRep && salesRep !== 'All') {
            activityMatch.createdBy = salesRep;
            prevActivityMatch.createdBy = salesRep;
        }

        // 1. Core Metrics
        const [
            totalClients,
            totalLeads,
            revenueData,
            activitiesThisMonth,
            activitiesLastMonth
        ] = await Promise.all([
            Client.countDocuments({ ...clientMatch, contactType: { $ne: 'Lead' } }),
            Client.countDocuments({ ...clientMatch, contactType: 'Lead' }),
            Client.aggregate([
                { $match: { ...clientMatch, contactStatus: { $ne: 'Closed lost' } } },
                { $group: { _id: null, total: { $sum: '$forecastedAmount' } } }
            ]),
            Activity.countDocuments(activityMatch),
            Activity.countDocuments(prevActivityMatch)
        ]);

        const forecastedRevenue = revenueData[0]?.total || 0;
        const activityGrowth = activitiesLastMonth === 0 ? 100 : Math.round(((activitiesThisMonth - activitiesLastMonth) / activitiesLastMonth) * 100);

        // 2. Leads by Stage (Funnel)
        const leadsByStageRaw = await Client.aggregate([
            { $match: { ...clientMatch, contactStatus: { $exists: true, $nin: [null, ''] } } },
            { $group: { _id: '$contactStatus', count: { $sum: 1 }, value: { $sum: '$forecastedAmount' } } },
            { $sort: { count: -1 } }
        ]);
        const leadsByStage = leadsByStageRaw.map(s => ({
            name: s._id,
            count: s.count,
            value: s.value || 0
        }));

        // 3. Leads by Type
        const leadsByTypeRaw = await Client.aggregate([
            { $match: { ...clientMatch, companyType: { $exists: true, $nin: [null, ''] } } },
            { $group: { _id: '$companyType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]);
        const leadsByType = leadsByTypeRaw.map(t => ({
            name: t._id,
            count: t.count
        }));

        // 4. Activities by Type
        const activityByTypeRaw = await Activity.aggregate([
            { $match: activityMatch },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        const activityByType = activityByTypeRaw.map(a => ({
            name: a._id,
            count: a.count
        }));

        // 4b. Activities by Rep per Type
        const activityByTypeAndRepRaw = await Activity.aggregate([
            { $match: activityMatch },
            { $group: { _id: { type: '$type', rep: '$createdBy' }, count: { $sum: 1 } } },
        ]);
        const activityByRep: Record<string, { rep: string; count: number }[]> = {};
        activityByTypeAndRepRaw.forEach(a => {
            const type = a._id.type || 'Unknown';
            let rep = a._id.rep || 'System';
            if (rep.includes('@')) rep = rep.split('@')[0]; // Simplify email to name
            
            if (!activityByRep[type]) activityByRep[type] = [];
            activityByRep[type].push({ rep, count: a.count });
        });
        
        for (const type in activityByRep) {
            activityByRep[type].sort((a, b) => b.count - a.count);
        }

        // 5. Recent Activity Feed
        let recentActivitiesQuery = Activity.find(activityMatch);
        const recentActivities = await recentActivitiesQuery
            .sort({ createdAt: -1 })
            .limit(10)
            .populate({ path: 'client', select: 'name' })
            .lean();

        // If clientMatch has salesPerson, we might want to filter recent activities by the client's salesPerson 
        // if the createdBy wasn't filtering enough. But since we filtered activityMatch.createdBy = salesRep, it's fine.
        // Also if we only have clientMatch, and we want activities FOR those clients, we'd need to filter by client ID.
        // For simplicity, if salesRep is set, activityMatch.createdBy handles it directly on the activity.

        return NextResponse.json({
            metrics: {
                totalClients,
                totalLeads,
                forecastedRevenue,
                activitiesThisMonth,
                activityGrowth
            },
            charts: {
                leadsByStage,
                leadsByType,
                activityByType,
                activityByRep
            },
            recentActivities
        });

    } catch (error: any) {
        console.error('CRM Dashboard API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
