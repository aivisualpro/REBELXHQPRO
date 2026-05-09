import { NextResponse } from 'next/server';
import { runBackup } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (
            !process.env.CRON_SECRET ||
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const startedAt = Date.now();
        const result = await runBackup();
        const durationMs = Date.now() - startedAt;

        return NextResponse.json({
            ok: true,
            durationMs,
            backup: {
                public_id: result.public_id,
                secure_url: result.secure_url,
                bytes: result.bytes,
                date: result.date,
                timestamp: result.timestamp,
            },
        });
    } catch (err: any) {
        console.error('[cron/backup] failed:', err);
        return NextResponse.json(
            { ok: false, error: err?.message || 'Backup failed' },
            { status: 500 },
        );
    }
}
