import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Stub route — prevents 404 errors from legacy/external requests
export async function GET() {
    return NextResponse.json({ notifications: [], total: 0, unreadCount: 0 });
}
