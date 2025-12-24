import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import Sku from '@/models/Sku';
import { applyDateFilter } from '@/lib/global-settings';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';

function parseDuration(duration: string): number {
    if (!duration) return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] + parts[1] / 60 + parts[2] / 3600;
    }
    if (parts.length === 2) {
        return parts[0] + parts[1] / 60;
    }
    return 0;
}

export async function GET(request: Request) {
    try {
        await dbConnect();
        // Ensure models are registered
        void Sku;
        void OpeningBalance;
        void PurchaseOrder;

        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const sku = searchParams.get('sku');
        const createdBy = searchParams.get('createdBy');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        let query: any = {};

        // If searching, first find matching SKU IDs by name
        let matchingSkuIds: string[] = [];
        if (search) {
            const matchingSkus = await Sku.find({
                name: { $regex: search, $options: 'i' }
            }).select('_id').lean();
            matchingSkuIds = matchingSkus.map((s: any) => s._id);
            
            query.$or = [
                { label: { $regex: search, $options: 'i' } }, // Search by label
                { '_id': { $regex: search, $options: 'i' } }, // or WO ID
                ...(matchingSkuIds.length > 0 ? [{ sku: { $in: matchingSkuIds } }] : [])
            ];
        }

        if (sku) {
            query.sku = { $in: sku.split(',') };
        }

        if (createdBy) {
            query.createdBy = { $in: createdBy.split(',') };
        }

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        // Apply Global Date Filter
        query = await applyDateFilter(query, 'createdAt');

        const total = await Manufacturing.countDocuments(query);
        const rawOrders = await Manufacturing.find(query)
                .populate('sku', 'name')
                .populate('createdBy', 'firstName lastName')
                .populate('finishedBy', 'firstName lastName')
                .populate({ path: 'lineItems.sku', select: 'name category' }) // Populate ingredient details
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

        // Calculate Costs
        const orders = await Promise.all(rawOrders.map(async (order: any) => {
            let materialCost = 0;
            let packagingCost = 0;
            let laborCost = 0;

            // 1. Calculate Labor Cost
            if (order.labor && Array.isArray(order.labor)) {
                order.labor.forEach((l: any) => {
                    laborCost += parseDuration(l.duration) * (l.hourlyRate || 0);
                });
            }

            // 2. Calculate Material & Packaging Cost
            if (order.lineItems && Array.isArray(order.lineItems)) {
                await Promise.all(order.lineItems.map(async (item: any) => {
                    const skuId = item.sku?._id || item.sku;
                    const lotNumber = item.lotNumber;
                    
                    if (!skuId || !lotNumber) return;

                    let unitCost = 0;

                    // Lookup Cost from OB
                    const ob = await OpeningBalance.findOne({ sku: skuId, lotNumber }).select('cost').lean();
                    if (ob) {
                        unitCost = ob.cost || 0;
                    } else {
                        // Lookup Cost from PO
                        const po = await PurchaseOrder.findOne({
                            'lineItems': { $elemMatch: { sku: skuId, lotNumber } } 
                        }).select('lineItems').lean();
                        
                        if (po && po.lineItems) {
                            const line = po.lineItems.find((l: any) => {
                                const lSku = l.sku?._id || l.sku;
                                return lSku?.toString() === skuId?.toString() && l.lotNumber === lotNumber;
                            });
                            if (line) unitCost = line.cost || 0;
                        }
                    }

                    // Calculate total value for this ingredient usage
                    // Logic: recipeQty * qty(batches/units) * unitCost
                    // Assuming order.qty corresponds to the multiplier for recipeQty
                    const totalConsumed = (item.recipeQty || 0) * (order.qty || 0); 
                    const totalVal = totalConsumed * unitCost;

                    const category = item.sku?.category?.toLowerCase();
                    if (category === 'packaging') {
                        packagingCost += totalVal;
                    } else {
                        materialCost += totalVal;
                    }
                }));
            }

            const totalCost = materialCost + packagingCost + laborCost;
            const costPerUnit = totalCost / (order.qty || 1);

            return {
                ...order,
                materialCost,
                packagingCost,
                laborCost,
                totalCost,
                costPerUnit
            };
        }));

        return NextResponse.json({
            orders,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const newItem = await Manufacturing.create(body);
        return NextResponse.json(newItem);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
