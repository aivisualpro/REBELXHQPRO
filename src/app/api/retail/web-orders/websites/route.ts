
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        
        // Find distinct websites from the top-level website field
        const websites = await WebOrder.distinct("website");
        
        // Filter out null/empty
        const cleanWebsites = websites.filter((w: any) => w && w !== '');
        
        return NextResponse.json({
            websites: cleanWebsites
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
