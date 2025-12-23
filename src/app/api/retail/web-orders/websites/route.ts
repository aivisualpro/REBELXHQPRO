
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        
        // Find distinct websites from line items
        // Since website is nested in lineItems array, this is the standard mongo way
        const websites = await WebOrder.distinct("lineItems.website");
        
        // Also check if there's a top-level website field (legacy or alternative schema)
        // Adjust based on your schema. Based on the file view, line items have 'website'.
        
        // Filter out null/empty
        const cleanWebsites = websites.filter((w: any) => w && w !== '');
        
        return NextResponse.json({
            websites: cleanWebsites
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
