import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listBackups } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'SuperAdmin' && role !== 'Admin') {
        return null;
    }
    return session;
}

export async function GET() {
    try {
        const session = await requireAdmin();
        if (!session) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const all = await listBackups();

        // Dedupe to one backup per date (keep newest by created_at)
        const byDate = new Map<string, (typeof all)[number]>();
        for (const b of all) {
            if (!b.date) continue;
            const existing = byDate.get(b.date);
            if (!existing) {
                byDate.set(b.date, b);
            } else if (new Date(b.created_at) > new Date(existing.created_at)) {
                byDate.set(b.date, b);
            }
        }

        const backups = Array.from(byDate.values()).sort((a, b) =>
            a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
        );

        return NextResponse.json({ ok: true, backups });
    } catch (err: any) {
        console.error('[admin/backups] list failed:', err);
        return NextResponse.json(
            { ok: false, error: err?.message || 'Failed to list backups' },
            { status: 500 },
        );
    }
}
