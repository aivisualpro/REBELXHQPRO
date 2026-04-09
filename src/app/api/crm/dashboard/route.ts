import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import Activity from '@/models/Activity';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();

        // Time boundaries
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // 1. Core Metrics
        const [
            totalClients,
            totalLeads,
            revenueData,
            activitiesThisMonth,
            activitiesLastMonth
        ] = await Promise.all([
            Client.countDocuments({ contactType: { $ne: 'Lead' } }),
            Client.countDocuments({ contactType: 'Lead' }),
            Client.aggregate([
                { $match: { contactStatus: { $ne: 'Closed lost' } } },
                { $group: { _id: null, total: { $sum: '$forecastedAmount' } } }
            ]),
            Activity.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Activity.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } })
        ]);

        const forecastedRevenue = revenueData[0]?.total || 0;
        const activityGrowth = activitiesLastMonth === 0 ? 100 : Math.round(((activitiesThisMonth - activitiesLastMonth) / activitiesLastMonth) * 100);

        // 2. Leads by Stage (Funnel)
        const leadsByStageRaw = await Client.aggregate([
            { $match: { contactStatus: { $exists: true, $nin: [null, ''] } } },
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
            { $match: { companyType: { $exists: true, $nin: [null, ''] } } },
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
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        const activityByType = activityByTypeRaw.map(a => ({
            name: a._id,
            count: a.count
        }));

        // 5. Recent Activity Feed
        const recentActivities = await Activity.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate({ path: 'client', select: 'name' })
            .lean();

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
                activityByType
            },
            recentActivities
        });

    } catch (error: any) {
        console.error('CRM Dashboard API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
