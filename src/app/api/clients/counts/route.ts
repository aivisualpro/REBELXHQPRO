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
                    foreignField: 'client',
                    as: 'orders'
                }
            },
            {
                $addFields: {
                    totalRevenue: { $sum: '$orders.totalAmount' }
                }
            },
            {
                $match: {
                    totalRevenue: { $gte: threshold }
                }
            },
            {
                $group: {
                    _id: { $ifNull: ['$companyType', 'Unknown'] },
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
