import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import SaleOrder from '@/models/SaleOrder';
import Activity from '@/models/Activity';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'name';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const salesPerson = searchParams.get('salesPerson');
        const contactStatus = searchParams.get('contactStatus');
        const contactType = searchParams.get('contactType');
        const companyType = searchParams.get('companyType');
        const city = searchParams.get('city');
        const state = searchParams.get('state');
        const defaultShippingTerms = searchParams.get('defaultShippingTerms');
        const minRevenue = searchParams.get('minRevenue') ? parseFloat(searchParams.get('minRevenue')!) : null;

        let query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { 'emails.value': { $regex: search, $options: 'i' } },
                { 'phones.value': { $regex: search, $options: 'i' } },
            ];
        }

        if (salesPerson) {
            query.salesPerson = { $in: salesPerson.split(',') };
        }
        if (contactStatus) {
            query.contactStatus = { $in: contactStatus.split(',') };
        }
        if (contactType) {
            query.contactType = { $in: contactType.split(',') };
        }
        if (companyType) {
            query.companyType = { $in: companyType.split(',') };
        }
        if (defaultShippingTerms) {
            query.defaultShippingTerms = { $in: defaultShippingTerms.split(',') };
        }
        if (city) {
            query['addresses.city'] = { $in: city.split(',').map(c => new RegExp(c, 'i')) };
        }
        if (state) {
            query['addresses.state'] = { $in: state.split(',').map(s => new RegExp(s, 'i')) };
        }

        let clients: any[] = [];
        let total = 0;

        // Common revenue aggregation logic
        const revenueLookup = [
            {
                $lookup: {
                    from: 'saleorders',
                    localField: '_id',
                    foreignField: 'clientId',
                    pipeline: [
                        { $match: { orderStatus: { $ne: 'Cancelled' } } },
                        {
                            $project: {
                                orderRevenue: {
                                    $subtract: [
                                        { $add: [{ $sum: { $ifNull: ["$lineItems.total", 0] } }, { $ifNull: ["$shippingCost", 0] }, { $ifNull: ["$tax", 0] }] },
                                        { $ifNull: ["$discount", 0] }
                                    ]
                                }
                            }
                        },
                        { $group: { _id: null, total: { $sum: "$orderRevenue" } } }
                    ],
                    as: 'revenueData'
                }
            },
            {
                $addFields: {
                    totalRevenue: { $ifNull: [{ $arrayElemAt: ["$revenueData.total", 0] }, 0] }
                }
            }
        ];

        if (minRevenue !== null || sortBy === 'totalRevenue') {
            const pipeline: any[] = [
                { $match: query },
                ...revenueLookup
            ];

            if (minRevenue !== null) {
                pipeline.push({ $match: { totalRevenue: { $gte: minRevenue } } });
            }

            // Get total count for pagination
            const countResult = await Client.aggregate([...pipeline, { $count: 'total' }]);
            total = countResult[0]?.total || 0;

            // Apply sort, skip, limit
            pipeline.push({ $sort: { [sortBy === 'totalRevenue' ? 'totalRevenue' : sortBy]: sortOrder as 1 | -1 } });
            pipeline.push({ $skip: (page - 1) * limit });
            pipeline.push({ $limit: limit });

            // Final enrichments
            pipeline.push(
                {
                    $lookup: {
                        from: 'rxhqusers',
                        localField: 'salesPerson',
                        foreignField: '_id',
                        as: 'salesPersonDoc'
                    }
                },
                { $unwind: { path: '$salesPersonDoc', preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        salesPerson: {
                            _id: '$salesPersonDoc._id',
                            firstName: '$salesPersonDoc.firstName',
                            lastName: '$salesPersonDoc.lastName'
                        }
                    }
                },
                { $project: { revenueData: 0, salesPersonDoc: 0 } }
            );

            clients = await Client.aggregate(pipeline);
        } else {
            [total, clients] = await Promise.all([
                Client.countDocuments(query),
                Client.find(query)
                    .populate('salesPerson', 'firstName lastName')
                    .sort({ [sortBy]: sortOrder as any })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean()
            ]);
        }

        // Get client IDs for activity and balance aggregation
        const clientIds = clients.map((c: any) => c._id);

        // Aggregate balance per client from SaleOrders (since totalRevenue might not have been calculated in the simple flow)
        const balanceAgg = await SaleOrder.aggregate([
            { $match: { clientId: { $in: clientIds }, orderStatus: { $ne: 'Cancelled' } } },
            {
                $project: {
                    clientId: 1,
                    itemsTotal: { $sum: { $ifNull: ["$lineItems.total", 0] } },
                    shippingCost: { $ifNull: ["$shippingCost", 0] },
                    tax: { $ifNull: ["$tax", 0] },
                    discount: { $ifNull: ["$discount", 0] },
                    paidAmount: { $sum: { $ifNull: ["$payments.paymentAmount", 0] } }
                }
            },
            {
                $project: {
                    clientId: 1,
                    orderRevenue: { $subtract: [{ $add: ["$itemsTotal", "$shippingCost", "$tax"] }, "$discount"] },
                    paidAmount: 1
                }
            },
            {
                $group: {
                    _id: '$clientId',
                    totalRevenue: { $sum: '$orderRevenue' },
                    totalPaid: { $sum: '$paidAmount' },
                    orderCount: { $sum: 1 }
                }
            }
        ]);

        // Aggregate activities per client
        const activityAgg = await Activity.aggregate([
            { $match: { client: { $in: clientIds.map(String) } } },
            {
                $group: {
                    _id: '$client',
                    activityCount: { $sum: 1 },
                    lastActivity: { $max: '$createdAt' }
                }
            }
        ]);

        // Create lookup maps
        const balanceMap = new Map(balanceAgg.map((r: any) => [
            r._id?.toString(),
            {
                revenue: r.totalRevenue || 0,
                balance: (r.totalRevenue || 0) - (r.totalPaid || 0),
                orderCount: r.orderCount || 0
            }
        ]));
        const activityMap = new Map(activityAgg.map((a: any) => [a._id?.toString(), { count: a.activityCount || 0, lastActivity: a.lastActivity }]));

        // Enrich clients with stats
        const enrichedClients = clients.map((c: any) => {
            const clientId = c._id?.toString();
            const balData = balanceMap.get(clientId) || { revenue: 0, balance: 0, orderCount: 0 };
            const activityData = activityMap.get(clientId) || { count: 0, lastActivity: null };

            return {
                ...c,
                totalRevenue: c.totalRevenue !== undefined ? c.totalRevenue : balData.revenue,
                balance: balData.balance,
                orderCount: balData.orderCount,
                activityCount: activityData.count,
                lastActivity: activityData.lastActivity
            };
        });

        return NextResponse.json({
            clients: enrichedClients,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();

        const newClient = await Client.create(body);

        return NextResponse.json(newClient);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
