import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import AuditAdjustment from '@/models/AuditAdjustment';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!data || !Array.length) {
            return NextResponse.json({ error: 'No data provided' }, { status: 400 });
        }

        // Build SKU legacyId -> _id lookup map
        const allSkuLegacyIds: string[] = [...new Set(data.map((item: any) => item.sku).filter(Boolean))] as string[];
        const skus = await Sku.find({ legacyId: { $in: allSkuLegacyIds } }).select('_id legacyId').lean();
        const skuMap = new Map<string, string>();
        skus.forEach((s: any) => {
            skuMap.set(s.legacyId, s._id.toString());
        });

        // Also try direct _id match for SKUs that might use _id directly
        const unmatchedIds = allSkuLegacyIds.filter((id: string) => !skuMap.has(id));
        if (unmatchedIds.length > 0) {
            const directSkus = await Sku.find({ _id: { $in: unmatchedIds } }).select('_id').lean();
            directSkus.forEach((s: any) => {
                skuMap.set(s._id.toString(), s._id.toString());
            });
        }

        const docs: any[] = [];
        const errors: string[] = [];

        data.forEach((item: any, i: number) => {
            const skuRef = item.sku;
            if (!skuRef) {
                errors.push(`Row ${i + 1}: Missing sku`);
                return;
            }

            const resolvedSku = skuMap.get(skuRef);
            if (!resolvedSku) {
                errors.push(`Row ${i + 1}: SKU '${skuRef}' not found`);
                return;
            }

            const qty = parseFloat(item.qty);
            if (isNaN(qty) || qty === 0) {
                errors.push(`Row ${i + 1}: Invalid qty '${item.qty}'`);
                return;
            }

            docs.push({
                _id: new mongoose.Types.ObjectId(),
                sku: resolvedSku,
                lotNumber: item.lotNumber || '',
                qty: qty,
                reason: item.reason || '',
                cost: parseFloat(item.cost) || 0,
                createdBy: item.createdBy || 'System Import',
                createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
                updatedAt: new Date()
            });
        });

        let insertedCount = 0;
        if (docs.length > 0) {
            const result = await AuditAdjustment.insertMany(docs, { ordered: false });
            insertedCount = result.length;
        }

        return NextResponse.json({
            message: 'Import completed',
            count: insertedCount,
            errors: errors.length > 0 ? errors.slice(0, 20) : [],
            totalErrors: errors.length,
            skuMapSize: skuMap.size,
            totalRows: data.length
        });
    } catch (error: any) {
        console.error('Audit Adjustment Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
