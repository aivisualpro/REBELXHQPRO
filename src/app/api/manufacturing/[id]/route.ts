import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';

import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import AuditAdjustment from '@/models/AuditAdjustment';
import User from '@/models/User';
import { Recipe } from '@/models/Recipe';
import { getSkuTiers } from '@/lib/sku-tiers';

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

// Helper to get ingredient cost from OB or PO
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

// Calculate manufacturing job cost on the fly (same logic as Lots API)
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
    
    // Sum ingredient costs - lookup costs from OpeningBalance/PurchaseOrder
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

// Optimized: Batch fetch all costs at once instead of sequential queries
async function enrichLineItemsWithCost(lineItems: any[]) {
    if (!lineItems || lineItems.length === 0) return lineItems;
    
    // Collect all unique sku+lot combinations
    const lookupKeys = new Set<string>();
    const lookupData: { skuId: string; lotNumber: string }[] = [];
    
    lineItems.forEach(item => {
        const skuId = item.sku?._id?.toString() || item.sku?.toString();
        const lotNumber = item.lotNumber;
        if (skuId && lotNumber) {
            const key = `${skuId}:${lotNumber}`;
            if (!lookupKeys.has(key)) {
                lookupKeys.add(key);
                lookupData.push({ skuId, lotNumber });
            }
        }
    });
    
    if (lookupData.length === 0) {
        return lineItems.map(item => ({ ...item, cost: 0 }));
    }
    
    // Extract unique values for queries
    const allSkuIds = [...new Set(lookupData.map(d => d.skuId))];
    const allLotNumbers = [...new Set(lookupData.map(d => d.lotNumber))];
    
    // Batch fetch all potential cost sources in parallel
    const [openingBalances, purchaseOrders, manufacturingJobs, auditAdjustments] = await Promise.all([
        OpeningBalance.find({
            sku: { $in: allSkuIds },
            lotNumber: { $in: allLotNumbers }
        }).select('sku lotNumber cost').lean(),
        
        PurchaseOrder.find({
            'lineItems.sku': { $in: allSkuIds },
            'lineItems.lotNumber': { $in: allLotNumbers }
        }).select('lineItems.sku lineItems.lotNumber lineItems.cost lineItems.price').lean(),
        
        Manufacturing.find({
            $or: [
                { sku: { $in: allSkuIds }, lotNumber: { $in: allLotNumbers } },
                { sku: { $in: allSkuIds }, label: { $in: allLotNumbers } }
            ]
        }).select('sku lotNumber label totalCost qty qtyDifference').lean(),
        
        AuditAdjustment.find({
            sku: { $in: allSkuIds },
            lotNumber: { $in: allLotNumbers }
        }).select('sku lotNumber cost').lean()
    ]);
    
    // Build cost lookup map: key = "skuId:lotNumber" -> cost
    const costMap = new Map<string, number>();
    
    // 1. Opening Balances (highest priority)
    openingBalances.forEach((ob: any) => {
        const key = `${ob.sku?.toString()}:${ob.lotNumber}`;
        if (ob.cost && !costMap.has(key)) {
            costMap.set(key, ob.cost);
        }
    });
    
    // 2. Purchase Orders
    purchaseOrders.forEach((po: any) => {
        po.lineItems?.forEach((line: any) => {
            const skuId = line.sku?._id?.toString() || line.sku?.toString();
            const key = `${skuId}:${line.lotNumber}`;
            if (!costMap.has(key) && (line.cost || line.price)) {
                costMap.set(key, line.cost || line.price);
            }
        });
    });
    
    // 3. Manufacturing Jobs (calculate per-unit cost)
    manufacturingJobs.forEach((job: any) => {
        const skuId = job.sku?._id?.toString() || job.sku?.toString();
        const lot = job.lotNumber || job.label;
        const key = `${skuId}:${lot}`;
        if (!costMap.has(key) && job.totalCost) {
            const qtyProduced = (job.qty || 0) + (job.qtyDifference || 0);
            if (qtyProduced > 0) {
                costMap.set(key, job.totalCost / qtyProduced);
            }
        }
    });
    
    // 4. Audit Adjustments
    auditAdjustments.forEach((adj: any) => {
        const key = `${adj.sku?.toString()}:${adj.lotNumber}`;
        if (!costMap.has(key) && adj.cost) {
            costMap.set(key, adj.cost);
        }
    });
    
    // Map costs to line items
    return lineItems.map(item => {
        const skuId = item.sku?._id?.toString() || item.sku?.toString();
        const key = `${skuId}:${item.lotNumber}`;
        const cost = costMap.get(key) || 0;
        return { ...item, cost };
    });
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        void Sku; 
        void User; 
        void Recipe; 
        void AuditAdjustment;

        const { id } = await context.params;

        const order = await Manufacturing.findById(id)
            .populate('sku', 'name image category')
            .populate('createdBy', 'firstName lastName email')
            .populate('finishedBy', 'firstName lastName email')
            .populate('lineItems.sku', 'name category')
            .populate('labor.user', 'firstName lastName email')
            .populate('notes.createdBy', 'firstName lastName email')
            .populate('recipesId', 'name sku steps qty notes')
            .lean();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.lineItems && Array.isArray(order.lineItems)) {
            order.lineItems = await enrichLineItemsWithCost(order.lineItems) as any;
        }

        // Enrich with Tiers
        const allSkuIds = new Set<string>();
        if (order.sku) {
            const skuId = (typeof order.sku === 'object' && order.sku !== null) ? ((order.sku as any)._id || order.sku).toString() : (order.sku as any).toString();
            allSkuIds.add(skuId);
        }
        order.lineItems?.forEach((li: any) => {
            const id = li.sku?._id || li.sku;
            if (id) allSkuIds.add(id.toString());
        });

        const tiers = await getSkuTiers(Array.from(allSkuIds));
        if (order.sku) {
            const skuId = (typeof order.sku === 'object' && order.sku !== null) ? ((order.sku as any)._id || order.sku).toString() : (order.sku as any).toString();
            (order.sku as any).tier = tiers[skuId];
        }
        order.lineItems?.forEach((li: any) => {
            const id = li.sku?._id || li.sku;
            if (id && li.sku && typeof li.sku === 'object') {
                li.sku.tier = tiers[id.toString()];
            }
        });

        return NextResponse.json(order);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();

        const order = await Manufacturing.findByIdAndUpdate(id, body, { new: true })
            .populate('sku', 'name image category')
            .populate('createdBy', 'firstName lastName email')
            .populate('finishedBy', 'firstName lastName email')
            .populate('lineItems.sku', 'name category')
            .populate('labor.user', 'firstName lastName email')
            .populate('notes.createdBy', 'firstName lastName email')
            .populate('recipesId', 'name sku steps qty notes')
            .lean();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.lineItems && Array.isArray(order.lineItems)) {
            order.lineItems = await enrichLineItemsWithCost(order.lineItems) as any;
        }

        // Enrich with Tiers
        const allSkuIds = new Set<string>();
        if (order.sku) {
            const skuId = (typeof order.sku === 'object' && order.sku !== null) ? ((order.sku as any)._id || order.sku).toString() : (order.sku as any).toString();
            allSkuIds.add(skuId);
        }
        order.lineItems?.forEach((li: any) => {
            const id = li.sku?._id || li.sku;
            if (id) allSkuIds.add(id.toString());
        });

        const tiers = await getSkuTiers(Array.from(allSkuIds));
        if (order.sku) {
            const skuId = (typeof order.sku === 'object' && order.sku !== null) ? ((order.sku as any)._id || order.sku).toString() : (order.sku as any).toString();
            (order.sku as any).tier = tiers[skuId];
        }
        order.lineItems?.forEach((li: any) => {
            const id = li.sku?._id || li.sku;
            if (id && li.sku && typeof li.sku === 'object') {
                li.sku.tier = tiers[id.toString()];
            }
        });

        return NextResponse.json(order);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const result = await Manufacturing.findByIdAndDelete(id);
        if (!result) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Order deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
