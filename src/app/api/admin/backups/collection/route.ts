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

        const sp = new URL(request.url).searchParams;
        const url = sp.get('url');
        const name = sp.get('name');
        const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
        const pageSize = Math.max(
            1,
            Math.min(500, parseInt(sp.get('pageSize') || '50', 10) || 50),
        );
        const full = sp.get('full') === 'true';

        if (!url || !name) {
            return NextResponse.json(
                { error: 'Missing url or name' },
                { status: 400 },
            );
        }
        if (!url.startsWith('https://res.cloudinary.com/')) {
            return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
        }

        const payload = await fetchAndParseBackup(url);
        const coll = payload.collections.find(c => c.name === name);
        if (!coll) {
            return NextResponse.json(
                { error: `Collection "${name}" not found in backup` },
                { status: 404 },
            );
        }

        if (full) {
            return NextResponse.json({
                ok: true,
                name: coll.name,
                count: coll.count,
                documents: coll.documents,
            });
        }

        const total = coll.documents.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * pageSize;
        const end = start + pageSize;

        return NextResponse.json({
            ok: true,
            name: coll.name,
            count: coll.count,
            page: safePage,
            pageSize,
            total,
            totalPages,
            documents: coll.documents.slice(start, end),
        });
    } catch (err: any) {
        console.error('[admin/backups/collection] failed:', err);
        return NextResponse.json(
            { ok: false, error: err?.message || 'Failed to load collection' },
            { status: 500 },
        );
    }
}
