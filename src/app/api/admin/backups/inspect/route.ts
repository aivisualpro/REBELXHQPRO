import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchAndParseBackup } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function requireAdmin() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'SuperAdmin' && role !== 'Admin') return null;
    return session;
}

export async function GET(request: Request) {
    try {
        const session = await requireAdmin();
        if (!session) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const url = new URL(request.url).searchParams.get('url');
        if (!url) {
            return NextResponse.json({ error: 'Missing url' }, { status: 400 });
        }
        if (!url.startsWith('https://res.cloudinary.com/')) {
            return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
        }

        const payload = await fetchAndParseBackup(url);

        return NextResponse.json({
            ok: true,
            metadata: payload.metadata,
            collections: payload.collections.map(c => ({
                name: c.name,
                count: c.count,
            })),
        });
    } catch (err: any) {
        console.error('[admin/backups/inspect] failed:', err);
        return NextResponse.json(
            { ok: false, error: err?.message || 'Failed to inspect backup' },
            { status: 500 },
        );
    }
}
