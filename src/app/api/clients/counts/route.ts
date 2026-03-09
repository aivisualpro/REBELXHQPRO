import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';

export const dynamic = 'force-dynamic';

// Returns company-type based counts for client tab badges (aggregation pipeline)
export async function GET() {
    try {
        await dbConnect();

        // Pipeline: count by companyType for all clients
        const pipeline = [
            {
                $group: {
                    _id: { $toUpper: { $ifNull: ['$companyType', 'UNKNOWN'] } },
                    count: { $sum: 1 }
                }
            }
        ];

        const typeCounts = await Client.aggregate(pipeline);

        // Map raw DB types into tab-bucket categories
        const TAB_MATCHERS: [string, RegExp][] = [
            ['MASTER DISTRO', /master\s*distro/i],
            ['VAPE STORE', /vape/i],
            ['DISTRO', /distro/i],
            ['SHOP', /shop/i],
            ['WHL', /whl/i],
        ];

        function classifyType(rawType: string): string {
            for (const [bucket, regex] of TAB_MATCHERS) {
                if (regex.test(rawType)) return bucket;
            }
            return 'POTENTIAL'; // default bucket for unknown types
        }

        // Build counts object with tab-aligned buckets
        const counts: Record<string, number> = { All: 0 };
        for (const tc of typeCounts) {
            const bucket = classifyType(tc._id);
            counts[bucket] = (counts[bucket] || 0) + tc.count;
            counts['All'] += tc.count;
        }

        return NextResponse.json({ counts });
    } catch (error: any) {
        console.error('Client counts error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
