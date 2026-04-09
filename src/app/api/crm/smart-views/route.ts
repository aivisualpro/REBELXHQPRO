import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import Activity from '@/models/Activity';
import Setting from '@/models/Setting';

export const dynamic = 'force-dynamic';

// Smart Views API - returns filtered client lists for each smart view
export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const view = searchParams.get('view');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '25');

        if (!view) {
            // Return counts for all smart views (used by sidebar badges)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            startOfWeek.setHours(0, 0, 0, 0);

            // Get threshold setting
            const thresholdSetting = await Setting.findOne({ key: 'crmMinRevenueSlab' });
            const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 20;

            // Get all clients with phone numbers (for "Daily Calling List" and "Leads to Call")
            const [
                dailyCallingCount,
                leadsToCallCount,
                noContactCount
            ] = await Promise.all([
                // Daily Calling List: Leads with phone numbers that haven't been called today
                (async () => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    // Find clients with phones
                    const clientsWithPhones = await Client.find(
                        { 'phones.0': { $exists: true } },
                        { _id: 1 }
                    ).lean();

                    if (clientsWithPhones.length === 0) return 0;

                    // Find which ones were called today
                    const calledToday = await Activity.distinct('client', {
                        type: 'Call',
                        createdAt: { $gte: today, $lt: tomorrow }
                    });

                    const calledSet = new Set(calledToday.map((id: any) => id.toString()));
                    return clientsWithPhones.filter(c => !calledSet.has(c._id.toString())).length;
                })(),


                // Leads to Call: Leads with phones but zero calls ever
                (async () => {
                    const clientsWithPhones = await Client.find(
                        { 'phones.0': { $exists: true } },
                        { _id: 1 }
                    ).lean();

                    if (clientsWithPhones.length === 0) return 0;

                    const calledEver = await Activity.distinct('client', { type: 'Call' });
                    const calledSet = new Set(calledEver.map((id: any) => id.toString()));

                    return clientsWithPhones.filter(c => !calledSet.has(c._id.toString())).length;
                })(),

                // No Contact > 7 Days: Clients/Leads with last activity older than 7 days
                (async () => {
                    const allClients = await Client.find({}, { _id: 1 }).lean();
                    if (allClients.length === 0) return 0;

                    const recentlyContacted = await Activity.distinct('client', {
                        createdAt: { $gte: sevenDaysAgo }
                    });

                    const recentSet = new Set(recentlyContacted.map((id: any) => id.toString()));
                    return allClients.filter(c => !recentSet.has(c._id.toString())).length;
                })(),

            ]);

            return NextResponse.json({
                counts: {
                    'daily-calling': dailyCallingCount,
                    'leads-to-call': leadsToCallCount,
                    'no-contact-7d': noContactCount
                }
            });
        }

        // Return actual data for a specific view
        let clients: any[] = [];
        let total = 0;
        const skip = (page - 1) * limit;

        switch (view) {
            case 'daily-calling': {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                // Find clients with phones
                const allWithPhones = await Client.find(
                    { 'phones.0': { $exists: true } },
                    { _id: 1 }
                ).lean();

                // Find which ones were called today
                const calledToday = await Activity.distinct('client', {
                    type: 'Call',
                    createdAt: { $gte: today, $lt: tomorrow }
                });

                const calledSet = new Set(calledToday.map((id: any) => id.toString()));
                const uncalledIds = allWithPhones
                    .filter(c => !calledSet.has(c._id.toString()))
                    .map(c => c._id);

                total = uncalledIds.length;
                clients = await Client.find({ _id: { $in: uncalledIds } })
                    .sort({ name: 1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();
                break;
            }


            case 'leads-to-call': {
                const clientsWithPhones = await Client.find(
                    { 'phones.0': { $exists: true } },
                    { _id: 1 }
                ).lean();

                const calledEver = await Activity.distinct('client', { type: 'Call' });
                const calledSet = new Set(calledEver.map((id: any) => id.toString()));
                const neverCalledIds = clientsWithPhones
                    .filter(c => !calledSet.has(c._id.toString()))
                    .map(c => c._id);

                total = neverCalledIds.length;
                clients = await Client.find({ _id: { $in: neverCalledIds } })
                    .sort({ name: 1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();
                break;
            }

            case 'no-contact-7d': {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                const allClients = await Client.find({}, { _id: 1 }).lean();
                const recentlyContacted = await Activity.distinct('client', {
                    createdAt: { $gte: sevenDaysAgo }
                });

                const recentSet = new Set(recentlyContacted.map((id: any) => id.toString()));
                const staleIds = allClients
                    .filter(c => !recentSet.has(c._id.toString()))
                    .map(c => c._id);

                total = staleIds.length;
                clients = await Client.find({ _id: { $in: staleIds } })
                    .sort({ updatedAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();
                break;
            }


            default:
                return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
        }

        // Enrich with activity data
        if (clients.length > 0) {
            const clientIds = clients.map(c => c._id);

            const activityAgg = await Activity.aggregate([
                { $match: { client: { $in: clientIds } } },
                {
                    $group: {
                        _id: '$client',
                        activityCount: { $sum: 1 },
                        emailCount: { $sum: { $cond: [{ $eq: ['$type', 'Email'] }, 1, 0] } },
                        callCount: { $sum: { $cond: [{ $eq: ['$type', 'Call'] }, 1, 0] } },
                        smsCount: { $sum: { $cond: [{ $eq: ['$type', 'Text'] }, 1, 0] } },
                        lastActivity: { $max: '$createdAt' }
                    }
                }
            ]);

            const activityMap = new Map(activityAgg.map((a: any) => [a._id.toString(), a]));

            clients = clients.map(c => {
                const act = activityMap.get(c._id.toString()) || {
                    activityCount: 0, emailCount: 0, callCount: 0, smsCount: 0, lastActivity: null
                };
                return {
                    ...c,
                    emailCount: act.emailCount,
                    callCount: act.callCount,
                    smsCount: act.smsCount,
                    lastActivity: act.lastActivity
                };
            });
        }

        return NextResponse.json({
            clients,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error: any) {
        console.error('Smart Views API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
