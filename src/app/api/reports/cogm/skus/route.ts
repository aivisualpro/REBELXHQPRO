import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        void Sku; 

        // 1. Get all unique main product SKUs
        const mainSkus = await Manufacturing.distinct('sku');
        
        // 2. Get all unique ingredient/material SKUs from lineItems
        const materialSkus = await Manufacturing.distinct('lineItems.sku');
        
        // 3. Combine and deduplicate
        const allSkuIds = Array.from(new Set([...mainSkus, ...materialSkus])).filter(id => id); // filter out nulls

        // 4. Fetch details for these SKUs
        const skus = await Sku.find({ _id: { $in: allSkuIds } })
            .select('_id name code')
            .sort({ name: 1 })
            .lean();

        return NextResponse.json({ skus });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
