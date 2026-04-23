/**
 * Lot Cost Helper
 * 
 * Derives per-lot costs for a SKU using the same logic as the SKU ledger.
 * This is the authoritative source of truth for lot costs, handling:
 * - Opening Balances
 * - Purchase Orders
 * - Manufacturing (including ingredient-based cost calculation)
 * - Audit Adjustments
 * 
 * Used by the Web Orders API for virtual cost calculation.
 */

import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';

const cleanLot = (lot: any): string => {
    if (lot === null || lot === undefined) return '';
    let s = String(lot).trim();
    s = s.replace(/,/g, '');
    s = s.replace(/\.0+$/, '');
    return s;
};

export const durationToHours = (duration: string): number => {
    if (!duration) return 0;
    const parts = duration.split(':').map(p => parseFloat(p) || 0);
    if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return parts[0] || 0;
};

export const calculateJobCostPerUnit = (job: any): number => {
    let costPerUnit = 0;

    // Use stored totalCost if available
    if (job.totalCost && job.totalCost > 0) {
        const totalQtyProduced = (job.qty || 0) + (job.qtyDifference || 0);
        costPerUnit = totalQtyProduced > 0 ? job.totalCost / totalQtyProduced : 0;
    } else {
        // Calculate from components (materials + labor + packaging)
        let totalMatCost = 0;
        job.lineItems?.forEach((li: any) => {
            if (!li.sku) return;
            const totalConsumed = ((li.recipeQty || 0) * (job.qty || 0)) + (li.qtyExtra || 0) + (li.qtyScrapped || 0);
            const ingredientCost = li.obCost || li.poCost || 0;
            totalMatCost += totalConsumed * ingredientCost;
        });

        let totalLaborCost = 0;
        job.labor?.forEach((l: any) => {
            totalLaborCost += durationToHours(l.duration) * (l.hourlyRate || 0);
        });

        const packagingCost = job.packagingCost || 0;
        const totalQtyProduced = (job.qty || 0) + (job.qtyDifference || 0);
        costPerUnit = totalQtyProduced > 0 ? (totalMatCost + totalLaborCost + packagingCost) / totalQtyProduced : 0;
    }

    return costPerUnit;
};

// ⚡ In-memory cache for lot costs (60s TTL)
const LOT_COST_CACHE_TTL = 60_000;
const lotCostCache = new Map<string, { data: Map<string, number>; timestamp: number }>();

/**
 * Get a map of lotNumber → cost for a given SKU.
 * Uses the same cost derivation as the SKU ledger:
 * OB → PO → Manufacturing (calculated from ingredients if totalCost != 0) → Audit
 * 
 * @param skuId The SKU _id (string)
 * @returns Map of lotNumber → cost
 */
export async function getLotsWithCost(skuId: string): Promise<Map<string, number>> {
    if (!skuId) return new Map();

    // Check cache
    const cached = lotCostCache.get(skuId);
    if (cached && (Date.now() - cached.timestamp) < LOT_COST_CACHE_TTL) {
        return cached.data;
    }

    await dbConnect();

    const skuOid = skuId !== 'all' && mongoose.Types.ObjectId.isValid(skuId) ? new mongoose.Types.ObjectId(skuId) : skuId;
    // Match against both ObjectId and plain string — different collections store sku differently
    const skuMatch = skuId === 'all' ? { $exists: true, $ne: null } : { $in: [skuOid, skuId] };

    // Fetch all source data in parallel using $group and $lookup aggregations
    // This replaces expensive in-memory array filtering and N+1 queries.
    const [openingBalances, purchaseOrders, manufacturingJobs, adjustments] = await Promise.all([
        // Priority 1: Opening Balances
        OpeningBalance.aggregate([
            { $match: { sku: skuMatch, cost: { $gt: 0 } } },
            { $group: { _id: '$lotNumber', cost: { $first: '$cost' } } }
        ]),
        
        // Priority 2: Purchase Orders
        PurchaseOrder.aggregate([
            { $match: { 'lineItems.sku': skuMatch } },
            { $unwind: '$lineItems' },
            { $match: { 
                'lineItems.sku': skuMatch, 
                'lineItems.qtyReceived': { $gt: 0 },
                'lineItems.lotNumber': { $exists: true, $nin: [null, ''] },
                $or: [ { 'lineItems.cost': { $gt: 0 } }, { 'lineItems.price': { $gt: 0 } } ]
            }},
            { $group: {
                _id: '$lineItems.lotNumber',
                cost: { $first: { $cond: [ { $gt: ['$lineItems.cost', 0] }, '$lineItems.cost', '$lineItems.price' ] } }
            }}
        ]),
        
        // Priority 3: Manufacturing
        Manufacturing.aggregate([
            { $match: { sku: skuMatch } },
            { $unwind: { path: '$lineItems', preserveNullAndEmptyArrays: true } },
            
            // Phase 1: In-db lookup of OpeningBalance ingredient costs
            { $lookup: {
                from: 'openingbalances',
                let: { iSku: '$lineItems.sku', iLot: '$lineItems.lotNumber' },
                pipeline: [
                    { $match: { $expr: { $and: [ { $eq: ['$sku', '$$iSku'] }, { $eq: ['$lotNumber', '$$iLot'] } ] } } },
                    { $limit: 1 },
                    { $project: { cost: 1 } }
                ],
                as: 'obData'
            }},
            
            // Phase 2: In-db lookup of PurchaseOrder ingredient costs
            { $lookup: {
                from: 'purchaseorders',
                let: { iSku: '$lineItems.sku', iLot: '$lineItems.lotNumber' },
                pipeline: [
                    { $match: { $expr: { $in: ['$$iSku', { $ifNull: ['$lineItems.sku', []] }] } } },
                    { $unwind: '$lineItems' },
                    { $match: { $expr: { $and: [ { $eq: ['$lineItems.sku', '$$iSku'] }, { $eq: ['$lineItems.lotNumber', '$$iLot'] } ] } } },
                    { $limit: 1 },
                    { $project: { cost: '$lineItems.cost', price: '$lineItems.price' } }
                ],
                as: 'poData'
            }},
            
            // Group the unwound items back into a single job document
            { $group: {
                _id: '$_id',
                sku: { $first: '$sku' },
                qty: { $first: '$qty' },
                qtyDifference: { $first: '$qtyDifference' },
                lotNumber: { $first: '$lotNumber' },
                label: { $first: '$label' },
                totalCost: { $first: '$totalCost' },
                labor: { $first: '$labor' },
                packagingCost: { $first: '$packagingCost' },
                status: { $first: '$status' },
                lineItems: { $push: {
                    sku: '$lineItems.sku',
                    recipeQty: '$lineItems.recipeQty',
                    qtyExtra: '$lineItems.qtyExtra',
                    qtyScrapped: '$lineItems.qtyScrapped',
                    lotNumber: '$lineItems.lotNumber',
                    obCost: { $arrayElemAt: ['$obData.cost', 0] },
                    poCost: { $let: {
                        vars: { poLine: { $arrayElemAt: ['$poData', 0] } },
                        in: { $cond: [{ $gt: ['$$poLine.cost', 0] }, '$$poLine.cost', '$$poLine.price'] }
                    }}
                }}
            }}
        ]),
        
        // Priority 4: Audit Adjustments
        AuditAdjustment.aggregate([
            { $match: { sku: skuMatch, cost: { $gt: 0 } } },
            { $group: { _id: '$lotNumber', cost: { $first: '$cost' } } }
        ])
    ]);


    const lotCosts = new Map<string, number>();

    // Apply Opening Balances
    openingBalances.forEach((ob: any) => {
        const lot = cleanLot(ob._id);
        if (lot && ob.cost && !lotCosts.has(lot)) {
            lotCosts.set(lot, ob.cost);
        }
    });

    // Apply Purchase Orders
    purchaseOrders.forEach((po: any) => {
        const lot = cleanLot(po._id);
        if (lot && po.cost > 0 && !lotCosts.has(lot)) {
            lotCosts.set(lot, po.cost);
        }
    });

    // Apply Manufacturing
    manufacturingJobs.forEach((job: any) => {
        const lot = cleanLot(job.lotNumber || job.label);
        if (!lot || lotCosts.has(lot)) return;

        const costPerUnit = calculateJobCostPerUnit(job);

        lotCosts.set(lot, costPerUnit);
    });

    // Apply Audit Adjustments
    adjustments.forEach((adj: any) => {
        const lot = cleanLot(adj._id);
        if (lot && adj.cost && !lotCosts.has(lot)) {
            lotCosts.set(lot, adj.cost);
        }
    });

    // Cache the result
    lotCostCache.set(skuId, { data: lotCosts, timestamp: Date.now() });

    return lotCosts;
}
