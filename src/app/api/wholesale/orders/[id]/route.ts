import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import Client from '@/models/Client';

export const dynamic = 'force-dynamic';

// Helper to parse duration "HH:MM:SS" to decimal hours
const parseDuration = (duration: string): number => {
    if (!duration) return 0;
    const parts = duration.split(':').map(p => parseFloat(p) || 0);
    if (parts.length === 3) {
        return parts[0] + parts[1] / 60 + parts[2] / 3600;
    } else if (parts.length === 2) {
        return parts[0] + parts[1] / 60;
    }
    return 0;
};

// Helper to get ingredient cost from OB or PO (needed for manufacturing calculation)
async function getIngredientCostFromSource(ingredientSkuId: string, ingredientLotNumber: string): Promise<number> {
    if (!ingredientSkuId || !ingredientLotNumber) return 0;
    
    // Check Opening Balance
    const ob = await OpeningBalance.findOne({
        sku: ingredientSkuId,
        lotNumber: ingredientLotNumber
    }).select('cost').lean();
    if (ob) return ob.cost || 0;
    
    // Check Purchase Orders
    const po = await PurchaseOrder.findOne({
        'lineItems': {
            $elemMatch: {
                sku: ingredientSkuId,
                lotNumber: ingredientLotNumber
            }
        }
    }).select('lineItems').lean();
    
    if (po && po.lineItems) {
        const line = po.lineItems.find((l: any) => {
            const lSku = l.sku?._id || l.sku;
            return lSku?.toString() === ingredientSkuId && l.lotNumber === ingredientLotNumber;
        });
        if (line) return line.cost || line.price || 0;
    }
    
    return 0;
}

// Calculate manufacturing job cost on the fly
async function calculateManufacturingJobCost(job: any): Promise<number> {
    const qtyManufactured = (job.qty || 0) + (job.qtyDifference || 0);
    if (qtyManufactured <= 0) return 0;
    
    // If totalCost is already calculated and saved, use it
    if (job.totalCost && job.totalCost > 0) {
        return job.totalCost / qtyManufactured;
    }
    
    // Otherwise, calculate on the fly from labor and ingredients
    let laborCost = 0;
    let ingredientCost = 0;
    
    // Sum labor costs
    if (job.labor && Array.isArray(job.labor)) {
        job.labor.forEach((labor: any) => {
            const hours = parseDuration(labor.duration);
            laborCost += hours * (labor.hourlyRate || 0);
        });
    }
    
    // Sum ingredient costs
    if (job.lineItems && Array.isArray(job.lineItems)) {
        for (const lineItem of job.lineItems) {
            const itemSkuId = (typeof lineItem.sku === 'object' && lineItem.sku !== null) 
                ? lineItem.sku._id?.toString() 
                : lineItem.sku?.toString();
            const bomQty = (lineItem.recipeQty || 0) * (job.qty || 0);
            const qtyExtra = lineItem.qtyExtra || 0;
            const qtyScrapped = lineItem.qtyScrapped || 0;
            const totalConsumed = bomQty + qtyExtra + qtyScrapped;
            
            // Lookup ingredient cost
            const unitCost = await getIngredientCostFromSource(itemSkuId, lineItem.lotNumber);
            ingredientCost += totalConsumed * unitCost;
        }
    }
    
    const totalJobCost = laborCost + ingredientCost;
    return totalJobCost / qtyManufactured;
}

async function enrichLineItemsWithCost(lineItems: any[]) {
    return Promise.all(lineItems.map(async (item: any) => {
        let cost = 0;
        const skuId = item.sku?._id || item.sku;
        const lotNumber = item.lotNumber;

        if (skuId && lotNumber) {
            // 1. Check Opening Balance
            const ob = await OpeningBalance.findOne({
                sku: skuId,
                lotNumber: lotNumber
            }).select('cost').lean();

            if (ob) {
                cost = ob.cost || 0;
            } else {
                // 2. Check Purchase Orders
                const po = await PurchaseOrder.findOne({
                    'lineItems': {
                        $elemMatch: {
                            sku: skuId,
                            lotNumber: lotNumber
                        }
                    }
                }).select('lineItems').lean();

                if (po && po.lineItems) {
                    const line = po.lineItems.find((l: any) => {
                        const lSku = l.sku?._id || l.sku;
                        return lSku?.toString() === skuId?.toString() && l.lotNumber === lotNumber;
                    });
                    if (line) {
                        cost = line.cost || line.price || 0;
                    }
                } else {
                    // 3. Check Manufacturing Jobs (as Source)
                    let job = await Manufacturing.findOne({
                        $or: [
                            { sku: skuId, lotNumber: lotNumber },
                            { sku: skuId, label: lotNumber }
                        ]
                    }).select('totalCost qty qtyDifference labor lineItems sku lotNumber label').lean();
                    
                    if (!job) {
                        const jobs = await Manufacturing.find({
                            $or: [
                                { lotNumber: lotNumber },
                                { label: lotNumber }
                            ]
                        }).select('totalCost qty qtyDifference labor lineItems sku lotNumber label').lean();
                        
                        job = jobs.find((j: any) => {
                            const jobSkuId = (typeof j.sku === 'object' && j.sku !== null) 
                                ? j.sku._id?.toString() 
                                : j.sku?.toString();
                            return jobSkuId === skuId?.toString();
                        }) || null;
                    }

                    if (job) {
                        cost = await calculateManufacturingJobCost(job);
                    } else {
                        // 4. Check Audit Adjustments
                        const adj = await AuditAdjustment.findOne({
                            sku: skuId,
                            lotNumber: lotNumber
                        }).select('cost').lean() as any;

                        if (adj) {
                            cost = adj.cost || 0;
                        }
                    }
                }
            }
        }
        // If no cost found from sources, fallback to the item's stored cost if available
        // But the requirement for "virtual" usually means "priority to lookup"
        return { ...item, cost: cost || item.cost || 0 };
    }));
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;

        // Ensure models are registered for populate
        void Sku;
        void Client;

        const order = await SaleOrder.findById(id)
            .populate('clientId', 'name')
            .populate('lineItems.sku', 'name')
            .lean();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.lineItems && Array.isArray(order.lineItems)) {
            order.lineItems = await enrichLineItemsWithCost(order.lineItems);
        }

        return NextResponse.json(order);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();

        if (body.lineItems && Array.isArray(body.lineItems)) {
            body.lineItems = body.lineItems.map((item: any) => ({
                ...item,
                total: (item.qtyShipped || 0) * (item.price || 0)
            }));
        }

        const updatedOrder = await SaleOrder.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true, runValidators: true }
        )
        .populate('clientId', 'name')
        .populate('lineItems.sku', 'name')
        .lean();

        if (!updatedOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (updatedOrder.lineItems && Array.isArray(updatedOrder.lineItems)) {
            updatedOrder.lineItems = await enrichLineItemsWithCost(updatedOrder.lineItems);
        }

        return NextResponse.json(updatedOrder);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;

        const deletedOrder = await SaleOrder.findByIdAndDelete(id);

        if (!deletedOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Order deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
