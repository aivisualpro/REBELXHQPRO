import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SyncMeta from '@/models/SyncMeta';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'products' or 'orders'
        
        const query = type ? { type } : {};
        const syncMetas = await SyncMeta.find(query).sort({ lastSyncAt: -1 }).lean();
        
        return NextResponse.json({
            success: true,
            data: syncMetas,
            summary: {
                totalRecords: syncMetas.reduce((sum, m: any) => sum + (m.recordsCount || 0), 0),
                lastSync: syncMetas.length > 0 ? syncMetas[0].lastSyncAt : null,
                websites: syncMetas.map((m: any) => ({
                    website: m.website,
                    type: m.type,
                    lastSyncAt: m.lastSyncAt,
                    lastFullSyncAt: m.lastFullSyncAt,
                    recordsCount: m.recordsCount,
                    lastStats: m.lastSyncStats
                }))
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
