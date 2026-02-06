import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import Activity from '@/models/Activity';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const activities = Array.isArray(body.data) ? body.data : body.activities;

        if (!Array.isArray(activities)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Extract all unique legacyIds from CSV (trimmed)
        const legacyIds = [...new Set(
            activities
                .map((a: any) => (a.client || a.clientid || a.clientId || a.legacyId || a.clientLegacyId || '').toString().trim())
                .filter(Boolean)
        )];

        // Batch-fetch all matching clients
        const clients = await Client.find({ legacyId: { $in: legacyIds } })
            .select('_id legacyId')
            .lean();

        const legacyToId = new Map<string, string>();
        clients.forEach((c: any) => {
            legacyToId.set(c.legacyId.toString().trim(), c._id.toString());
        });

        let insertedCount = 0;
        const missingLegacyIds: string[] = [];
        const toInsert: any[] = [];

        for (const item of activities) {
            const rawClientId = (item.client || item.clientid || item.clientId || item.legacyId || item.clientLegacyId || '').toString().trim();
            if (!rawClientId) {
                continue;
            }

            const clientObjectId = legacyToId.get(rawClientId);
            if (!clientObjectId) {
                if (!missingLegacyIds.includes(rawClientId)) {
                    missingLegacyIds.push(rawClientId);
                }
                continue;
            }

            const type = (item.type || 'Call').trim();
            const comments = item.comments || '';
            const createdBy = item.createdBy || 'Import';

            let createdAt = new Date();
            if (item.createdAt && !isNaN(Date.parse(item.createdAt))) {
                createdAt = new Date(item.createdAt);
            }

            toInsert.push({
                type,
                client: clientObjectId,
                comments,
                createdBy,
                createdAt
            });
        }

        // Bulk insert in batches of 5000 to avoid memory issues
        const BATCH_SIZE = 5000;
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
            const batch = toInsert.slice(i, i + BATCH_SIZE);
            await Activity.insertMany(batch, { ordered: false });
        }
        insertedCount = toInsert.length;

        if (missingLegacyIds.length > 0) {
            console.log('Missing client legacyIds:', missingLegacyIds);
        }

        return NextResponse.json({
            message: 'Import completed',
            count: insertedCount,
            missingClients: missingLegacyIds.length,
            missingClientIds: missingLegacyIds.slice(0, 50), // return first 50 for debugging
            totalProcessed: activities.length
        });
    } catch (error: any) {
        console.error("Import Activities Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
