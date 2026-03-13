import { NextResponse } from 'next/server';
import { POST as runOrderSync } from '../../retail/web-orders/sync/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — match the sync route's timeout

export async function GET(request: Request) {
    try {
        // Authenticate the request via Vercel's Cron Secret if configured
        const authHeader = request.headers.get('authorization');
        if (
            process.env.CRON_SECRET &&
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Create a stub POST request pointing to the internal sync route
        const url = new URL('/api/retail/web-orders/sync', request.url);
        const stubRequest = new Request(url.toString(), {
            method: 'POST',
            headers: request.headers
        });

        // Trigger the actual sync POST logic
        const resultResponse = await runOrderSync(stubRequest);
        
        // Ensure successful kick-off
        if (!resultResponse.ok) {
            const errorData = await resultResponse.json();
            return NextResponse.json({ error: errorData }, { status: resultResponse.status });
        }
        
        const data = await resultResponse.json();
        return NextResponse.json({ success: true, message: 'Cron job successfully triggered web order sync', data });
        
    } catch (err: any) {
        console.error('Cron Web Orders Sync Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
