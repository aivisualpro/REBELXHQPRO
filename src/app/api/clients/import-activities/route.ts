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

        // Build a legacyId → _id lookup map (batch query)
        const legacyIds = [...new Set(
            activities
                .map((a: any) => a.client || a.clientid || a.clientId || a.legacyId || a.clientLegacyId)
                .filter(Boolean)
        )];

        const clients = await Client.find({ legacyId: { $in: legacyIds } })
            .select('_id legacyId')
            .lean();

        const legacyToId = new Map<string, string>();
        clients.forEach((c: any) => {
            legacyToId.set(c.legacyId, c._id.toString());
        });

        // Build existing activity keys for deduplication
        const existingActivities = await Activity.find({
            client: { $in: clients.map((c: any) => c._id) }
        }).select('type client comments createdAt').lean();

        const existingKeys = new Set<string>();
        existingActivities.forEach((a: any) => {
            const key = `${a.client}_${a.type}_${(a.comments || '').substring(0, 50)}_${a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : ''}`;
            existingKeys.add(key);
        });

        let insertedCount = 0;
        let skippedCount = 0;
        let missingClientCount = 0;
        const toInsert: any[] = [];

        for (const item of activities) {
            const clientLegacyId = item.client || item.clientid || item.clientId || item.legacyId || item.clientLegacyId;
            if (!clientLegacyId) {
                missingClientCount++;
                continue;
            }

            const clientObjectId = legacyToId.get(clientLegacyId);
            if (!clientObjectId) {
                missingClientCount++;
                continue;
            }

            const type = item.type || 'Call';
            const comments = item.comments || '';
            const createdBy = item.createdBy || 'Import';

            let createdAt = new Date();
            if (item.createdAt && !isNaN(Date.parse(item.createdAt))) {
                createdAt = new Date(item.createdAt);
            }

            // Dedup check
            const key = `${clientObjectId}_${type}_${comments.substring(0, 50)}_${createdAt.toISOString().split('T')[0]}`;
            if (existingKeys.has(key)) {
                skippedCount++;
                continue;
            }
            existingKeys.add(key);

            toInsert.push({
                type,
                client: clientObjectId,
                comments,
                createdBy,
                createdAt
            });
        }

        // Bulk insert
        if (toInsert.length > 0) {
            await Activity.insertMany(toInsert);
            insertedCount = toInsert.length;
        }

        return NextResponse.json({
            message: 'Import completed',
            count: insertedCount,
            skippedDuplicates: skippedCount,
            missingClients: missingClientCount,
            totalProcessed: activities.length
        });
    } catch (error: any) {
        console.error("Import Activities Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
