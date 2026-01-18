import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import SaleOrder from '@/models/SaleOrder';
import Activity from '@/models/Activity';
import Setting from '@/models/Setting';
import mongoose from 'mongoose';

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
        const contactStatusNin = searchParams.get('contactStatus_nin');
        const contactType = searchParams.get('contactType');
        const contactTypeNin = searchParams.get('contactType_nin');
        const companyType = searchParams.get('companyType');
        const city = searchParams.get('city');
        const state = searchParams.get('state');
        const defaultShippingTerms = searchParams.get('defaultShippingTerms');
        let minRevenue = searchParams.get('minRevenue') ? parseFloat(searchParams.get('minRevenue')!) : null;
        let maxRevenue = searchParams.get('maxRevenue') ? parseFloat(searchParams.get('maxRevenue')!) : null;
        const minBalance = searchParams.get('minBalance') ? parseFloat(searchParams.get('minBalance')!) : null;
        const maxBalance = searchParams.get('maxBalance') ? parseFloat(searchParams.get('maxBalance')!) : null;

        // Fetch dynamic threshold setting
        const thresholdSetting = await Setting.findOne({ key: 'crmMinRevenueSlab' });
        const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 20;

        // Apply business logic defaults if not manually overridden
        // If query strictly asks for 'Client', enforce minRevenue >= threshold
        const isClientQuery = (contactStatus === 'Client' || contactType === 'Client');
        const isLeadQuery = (contactStatus === 'Lead' || contactType === 'Lead');

        if (isClientQuery && minRevenue === null) {
            minRevenue = threshold;
        }
        if (isLeadQuery && maxRevenue === null) {
            maxRevenue = threshold;
        }

        let query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { 'emails.value': { $regex: search, $options: 'i' } },
                { 'phones.value': { $regex: search, $options: 'i' } },
            ];
        }

        if (salesPerson) query.salesPerson = { $in: salesPerson.split(',') };
        
        if (contactStatus) {
            query.contactStatus = { $in: contactStatus.split(',') };
        } else if (contactStatusNin) {
            query.contactStatus = { $nin: contactStatusNin.split(',') };
        }

        if (contactType) {
            query.contactType = { $in: contactType.split(',') };
        } else if (contactTypeNin) {
            query.contactType = { $nin: contactTypeNin.split(',') };
        }
        
        if (companyType) query.companyType = { $in: companyType.split(',') };
        if (defaultShippingTerms) query.defaultShippingTerms = { $in: defaultShippingTerms.split(',') };
        
        if (city) query['addresses.city'] = { $in: city.split(',').map(c => new RegExp(c.trim(), 'i')) };
        if (state) query['addresses.state'] = { $in: state.split(',').map(s => new RegExp(s.trim(), 'i')) };

        let clients: any[] = [];
        let total = 0;

        // Optimized revenue and balance calculation pipeline chunk
        const financialLookup = [
            {
                $lookup: {
                    from: 'saleorders',
                    localField: '_id',
                    foreignField: 'clientId',
                    pipeline: [
                        { $match: { orderStatus: { $ne: 'Cancelled' } } },
                        {
                            $project: {
                                amount: {
                                    $subtract: [
                                        { $add: [{ $sum: "$lineItems.total" }, { $ifNull: ["$shippingCost", 0] }, { $ifNull: ["$tax", 0] }] },
                                        { $ifNull: ["$discount", 0] }
                                    ]
                                },
                                paid: { $sum: "$payments.paymentAmount" }
                            }
                        },
                        { $group: { _id: null, total: { $sum: "$amount" }, paid: { $sum: "$paid" } } }
                    ],
                    as: 'pricing'
                }
            },
            {
                $addFields: {
                    totalRevenue: { $ifNull: [{ $arrayElemAt: ["$pricing.total", 0] }, 0] },
                    totalPaid: { $ifNull: [{ $arrayElemAt: ["$pricing.paid", 0] }, 0] }
                }
            },
            {
                $addFields: {
                    balance: { $subtract: ["$totalRevenue", "$totalPaid"] }
                }
            }
        ];

        // Execute main fetch logic
        if (minRevenue !== null || maxRevenue !== null || minBalance !== null || maxBalance !== null || sortBy === 'totalRevenue' || sortBy === 'balance') {
            const basePipeline = [{ $match: query }, ...financialLookup];
            
            const rangeFilter: any = {};
            if (minRevenue !== null) rangeFilter.totalRevenue = { ...rangeFilter.totalRevenue, $gte: minRevenue };
            if (maxRevenue !== null) rangeFilter.totalRevenue = { ...rangeFilter.totalRevenue, $lt: maxRevenue };
            
            if (minBalance !== null) rangeFilter.balance = { ...rangeFilter.balance, $gte: minBalance };
            if (maxBalance !== null) rangeFilter.balance = { ...rangeFilter.balance, $lt: maxBalance };
            
            if (Object.keys(rangeFilter).length > 0) {
                basePipeline.push({ $match: rangeFilter });
            }

            // Using facet to get both count and paginated data in one go might be slower for very large collections,
            // but for typical CRM sizes it's cleaner. Let's use parallel calls instead for better reliability.
            const [countRes, dataRes] = await Promise.all([
                Client.aggregate([...basePipeline, { $count: 'total' }]),
                Client.aggregate([
                    ...basePipeline,
                    { $sort: { [sortBy === 'totalRevenue' || sortBy === 'balance' ? sortBy : sortBy]: sortOrder as any } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    { $project: { pricing: 0 } } // Clean up temp fields
                ])
            ]);

            total = countRes[0]?.total || 0;
            clients = dataRes;
        } else {
            [total, clients] = await Promise.all([
                Client.countDocuments(query),
                Client.find(query)
                    .sort({ [sortBy]: sortOrder as any })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean()
            ]);
        }

        // Enrich with secondary data (Balance, Activities, SalesRep) in parallel
        if (clients.length > 0) {
            const clientIds = clients.map(c => c._id);
            
            const [balanceAgg, activityAgg] = await Promise.all([
                SaleOrder.aggregate([
                    { $match: { clientId: { $in: clientIds }, orderStatus: { $ne: 'Cancelled' } } },
                    {
                        $project: {
                            clientId: 1,
                            revenue: { $subtract: [{ $add: [{ $sum: "$lineItems.total" }, { $ifNull: ["$shippingCost", 0] }, { $ifNull: ["$tax", 0] }] }, { $ifNull: ["$discount", 0] }] },
                            paid: { $sum: "$payments.paymentAmount" }
                        }
                    },
                    {
                        $group: {
                            _id: '$clientId',
                            totalRev: { $sum: '$revenue' },
                            totalPaid: { $sum: '$paid' },
                            count: { $sum: 1 }
                        }
                    }
                ]),
                Activity.aggregate([
                    { $match: { client: { $in: clientIds.map(String) } } },
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
                ])
            ]);

            // Map results for quick lookup
            const balanceMap = new Map(balanceAgg.map((r: any) => [r._id.toString(), r]));
            const activityMap = new Map(activityAgg.map((a: any) => [a._id.toString(), a]));

            // Populate sales rep manually (often faster than populate for small arrays)
            const salesRepIds = [...new Set(clients.map(c => c.salesPerson).filter(id => id && typeof id === 'string'))];
            const users = await mongoose.model('RXHQUsers').find({ _id: { $in: salesRepIds } }, 'firstName lastName').lean();
            const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

            clients = clients.map(c => {
                const clientId = c._id.toString();
                const bal = balanceMap.get(clientId) || { totalRev: 0, totalPaid: 0, count: 0 };
                const act = activityMap.get(clientId) || { activityCount: 0, emailCount: 0, callCount: 0, smsCount: 0, lastActivity: null };
                const rep = userMap.get(c.salesPerson?.toString());

                return {
                    ...c,
                    totalRevenue: c.totalRevenue !== undefined ? c.totalRevenue : bal.totalRev,
                    balance: (bal.totalRev || 0) - (bal.totalPaid || 0),
                    orderCount: bal.count,
                    activityCount: act.activityCount,
                    emailCount: act.emailCount,
                    callCount: act.callCount,
                    smsCount: act.smsCount,
                    lastActivity: act.lastActivity,
                    salesPerson: rep || null
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
        console.error("GET Clients Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();

        // 1. Generate a manual string ID if not present (since schema uses String for _id)
        if (!body._id) {
            body._id = 'CL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        }

        // 2. Format notes if it's a string (from UI)
        if (typeof body.notes === 'string') {
            if (body.notes.trim()) {
                body.notes = [{ note: body.notes.trim() }];
            } else {
                body.notes = [];
            }
        }

        const newClient = await Client.create(body);

        return NextResponse.json(newClient);
    } catch (error: any) {
        console.error('Add client error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
