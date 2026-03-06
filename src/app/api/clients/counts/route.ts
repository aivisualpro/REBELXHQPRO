import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import Setting from '@/models/Setting';

export const dynamic = 'force-dynamic';

// Returns company-type based counts for client tab badges (aggregation pipeline)
export async function GET() {
    try {
        await dbConnect();

        // Get threshold
        const thresholdSetting = await Setting.findOne({ key: 'crmMinRevenueSlab' });
        const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 20;

        // Pipeline: count by companyType for clients (revenue >= threshold)
        const pipeline = [
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
                                }
                            }
                        },
                        { $group: { _id: null, total: { $sum: "$amount" } } }
                    ],
                    as: 'pricing'
                }
            },
            {
                $addFields: {
                    totalRevenue: { $ifNull: [{ $arrayElemAt: ["$pricing.total", 0] }, 0] }
                }
            },
            {
                $match: {
                    totalRevenue: { $gte: threshold }
                }
            },
            {
                $group: {
                    _id: { $toUpper: { $ifNull: ['$companyType', 'UNKNOWN'] } },
                    count: { $sum: 1 }
                }
            }
        ];

        const typeCounts = await Client.aggregate(pipeline);

        // Build counts object
        const counts: Record<string, number> = { All: 0 };
        for (const tc of typeCounts) {
            counts[tc._id] = tc.count;
            counts['All'] += tc.count;
        }

        return NextResponse.json({ counts });
    } catch (error: any) {
        console.error('Client counts error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
