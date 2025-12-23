import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await dbConnect();
        void Sku; // Reference to ensure model is loaded
        
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const skuFilter = searchParams.get('sku');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        // Build query
        let query: any = {};

        // Date filter
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate + 'T23:59:59.999Z')
            };
        }

        // SKU filter (search in main product OR component materials)
        if (skuFilter) {
            const skus = skuFilter.split(',');
            query.$or = [
                { sku: { $in: skus } },
                { 'lineItems.sku': { $in: skus } }
            ];
        }

        // Fetch manufacturing records with populated fields
        const [total, records] = await Promise.all([
            Manufacturing.countDocuments(query),
            Manufacturing.find(query)
                .populate('sku', 'name')
                .populate('createdBy', 'firstName lastName')
                .populate('finishedBy', 'firstName lastName')
                .populate('lineItems.sku', 'name')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        // Calculate summary statistics
        const summaryAgg = await Manufacturing.aggregate([
            { $match: query },
            { $group: {
                _id: null,
                totalBatches: { $sum: 1 },
                totalQtyProduced: { $sum: { $ifNull: ["$qty", 0] } },
                completedBatches: { 
                    $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } 
                },
                inProgressBatches: { 
                    $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } 
                },
                draftBatches: { 
                    $sum: { $cond: [{ $eq: ["$status", "Draft"] }, 1, 0] } 
                }
            }}
        ]);

        // Get line items summary (materials used)
        const materialsAgg = await Manufacturing.aggregate([
            { $match: query },
            { $unwind: "$lineItems" },
            { $group: {
                _id: "$lineItems.sku",
                totalQty: { $sum: { $ifNull: ["$lineItems.recipeQty", 0] } },
                totalScrapped: { $sum: { $ifNull: ["$lineItems.qtyScrapped", 0] } },
                batchCount: { $sum: 1 }
            }},
            { $sort: { totalQty: -1 } },
            { $limit: 10 },
            { $lookup: {
                from: "skus",
                localField: "_id",
                foreignField: "_id",
                as: "skuDetails"
            }},
            { $unwind: { path: "$skuDetails", preserveNullAndEmptyArrays: true } },
            { $project: {
                name: { $ifNull: ["$skuDetails.name", "$_id"] },
                totalQty: 1,
                totalScrapped: 1,
                batchCount: 1
            }}
        ]);

        // Get production by SKU summary
        const productionBySku = await Manufacturing.aggregate([
            { $match: query },
            { $group: {
                _id: "$sku",
                totalQty: { $sum: { $ifNull: ["$qty", 0] } },
                batchCount: { $sum: 1 }
            }},
            { $sort: { totalQty: -1 } },
            { $limit: 10 },
            { $lookup: {
                from: "skus",
                localField: "_id",
                foreignField: "_id",
                as: "skuDetails"
            }},
            { $unwind: { path: "$skuDetails", preserveNullAndEmptyArrays: true } },
            { $project: {
                name: { $ifNull: ["$skuDetails.name", "$_id"] },
                totalQty: 1,
                batchCount: 1
            }}
        ]);

        const summary = summaryAgg[0] || {
            totalBatches: 0,
            totalQtyProduced: 0,
            completedBatches: 0,
            inProgressBatches: 0,
            draftBatches: 0
        };

        return NextResponse.json({
            records,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            summary,
            topMaterials: materialsAgg,
            productionBySku
        });

    } catch (error: any) {
        console.error("COGM API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
