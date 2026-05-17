/**
 * POST /api/skus/recompute-stock          — bulk recompute all SKUs (or targeted skuIds)
 * GET  /api/skus/recompute-stock          — same, browser-triggerable
 */
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import { recomputeSkuStock } from '@/lib/recompute-sku-stock';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function runRecompute(ids?: string[]) {
    await dbConnect();
    const targetIds = ids && ids.length > 0
        ? ids
        : (await Sku.find({}).select('_id').lean()).map((s: any) => s._id?.toString()).filter(Boolean);

    console.log(`[recompute-stock] Starting for ${targetIds.length} SKUs...`);
    const BATCH = ids?.length ? targetIds.length : 10; // targeted = all at once, bulk = 10
    let done = 0;
    for (let i = 0; i < targetIds.length; i += BATCH) {
        const batch = targetIds.slice(i, i + BATCH);
        await recomputeSkuStock(...batch);
        done += batch.length;
        if (!ids?.length) console.log(`[recompute-stock] ${done}/${targetIds.length}`);
    }
    return targetIds.length;
}

export async function GET() {
    try {
        const total = await runRecompute();
        return NextResponse.json({ success: true, total });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        let skuIds: string[] | undefined;
        try {
            const body = await req.json();
            if (Array.isArray(body?.skuIds) && body.skuIds.length > 0) {
                skuIds = body.skuIds;
            }
        } catch { /* no body or not JSON — run full recompute */ }

        const total = await runRecompute(skuIds);
        return NextResponse.json({ success: true, total });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
