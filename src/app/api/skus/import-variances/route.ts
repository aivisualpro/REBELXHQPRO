import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body; // Changed from 'variances' to 'data' for consistency with settings import pattern

        const variances = Array.isArray(data) ? data : body.variances; // Fallback to old format

        if (!Array.isArray(variances)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Build lookup map for SKUs by legacyId
        const skuLegacyIds = variances.map((v: any) => v.skuLegacyId || v.legacyId).filter(Boolean);
        const existingByLegacyId = await Sku.find({ 
            legacyId: { $in: skuLegacyIds }
        }).select('_id legacyId').lean();
        
        const legacyIdToSkuId = new Map<string, string>();
        existingByLegacyId.forEach((sku: any) => {
            if (sku.legacyId) {
                legacyIdToSkuId.set(sku.legacyId, sku._id);
            }
        });

        const operations = variances
            .filter((item: any) => item.name && (item.sku || item.skuLegacyId || item.legacyId))
            .map((item: any) => {
                // Determine the SKU ID to target
                let skuId = item.sku;
                const skuLegacyId = item.skuLegacyId || item.legacyId;
                if (skuLegacyId && legacyIdToSkuId.has(skuLegacyId)) {
                    skuId = legacyIdToSkuId.get(skuLegacyId);
                }

                return {
                    updateOne: {
                        filter: { _id: skuId },
                        update: {
                            $push: {
                                variances: {
                                    _id: item._id || new mongoose.Types.ObjectId().toString(),
                                    name: item.name,
                                    website: item.website,
                                    image: item.image
                                }
                            }
                        }
                    }
                };
            });

        if (operations.length === 0) {
            return NextResponse.json({ message: 'No valid variances to import', count: 0 });
        }

        const result = await Sku.bulkWrite(operations as any);

        return NextResponse.json({
            message: 'Variances import completed',
            count: result.modifiedCount
        });
    } catch (error: any) {
        console.error('Variances Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
