import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import Activity from '@/models/Activity';
import SaleOrder from '@/models/SaleOrder';
import RXHQUsers from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const tab = searchParams.get('tab') || 'activities';

        // Fetch the client
        const client = await Client.findById(id).lean();
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        // Fetch sales rep info if exists
        let salesRep = null;
        if (client.salesPerson) {
            salesRep = await RXHQUsers.findById(client.salesPerson, 'firstName lastName email').lean();
        }

        // Fetch activities for this client (paginated)
        const activitiesQuery = Activity.find({ client: id })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const [activities, totalActivities, totalEmails, totalCalls, totalSMS] = await Promise.all([
            activitiesQuery.lean(),
            Activity.countDocuments({ client: id }),
            Activity.countDocuments({ client: id, type: 'Email' }),
            Activity.countDocuments({ client: id, type: 'Call' }),
            Activity.countDocuments({ client: id, type: 'Text' })
        ]);

        // Fetch activity creators for name display
        const creatorIds = [...new Set(activities.map((a: any) => a.createdBy).filter(Boolean))];
        const creators = await RXHQUsers.find({ _id: { $in: creatorIds } }, 'firstName lastName').lean();
        const creatorMap = new Map(creators.map((c: any) => [c._id.toString(), `${c.firstName || ''} ${c.lastName || ''}`.trim()]));

        const activitiesWithCreator = activities.map((a: any) => ({
            ...a,
            createdByName: creatorMap.get(a.createdBy?.toString()) || a.createdBy || 'Unknown'
        }));

        // Fetch wholesale orders (SaleOrders) for this client (paginated)
        const ordersQuery = SaleOrder.find({ clientId: id })
            .populate('salesRep', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const [orders, totalOrders] = await Promise.all([
            ordersQuery.lean(),
            SaleOrder.countDocuments({ clientId: id })
        ]);

        // Calculate summary stats
        const allOrders = await SaleOrder.find({ clientId: id, orderStatus: { $ne: 'Cancelled' } }).lean();
        let totalRevenue = 0;
        let totalPaid = 0;
        
        allOrders.forEach((o: any) => {
            const lineTotal = (o.lineItems || []).reduce((sum: number, li: any) => sum + ((li.qtyShipped || 0) * (li.price || 0)), 0);
            const orderTotal = lineTotal + (o.shippingCost || 0) + (o.tax || 0) - (o.discount || 0);
            totalRevenue += orderTotal;
            
            const orderPaid = (o.payments || []).reduce((sum: number, p: any) => sum + (p.paymentAmount || 0), 0);
            totalPaid += orderPaid;
        });

        const totalBalance = totalRevenue - totalPaid;

        // Find last activity and last order dates
        const lastActivity = await Activity.findOne({ client: id }).sort({ createdAt: -1 }).lean();
        const lastOrder = await SaleOrder.findOne({ clientId: id, orderStatus: { $ne: 'Cancelled' } }).sort({ createdAt: -1 }).lean();

        return NextResponse.json({
            client: {
                ...client,
                salesRepInfo: salesRep
            },
            summary: {
                totalOrders: totalOrders,
                totalRevenue,
                totalBalance,
                totalActivities,
                totalEmails,
                totalCalls,
                totalSMS,
                lastActivityDate: lastActivity?.createdAt || null,
                lastOrderDate: lastOrder?.createdAt || null
            },
            activities: activitiesWithCreator,
            orders,
            pagination: {
                page,
                limit,
                totalActivities,
                totalOrders,
                hasMoreActivities: page * limit < totalActivities,
                hasMoreOrders: page * limit < totalOrders
            }
        });
    } catch (error: any) {
        console.error('Client dashboard error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
