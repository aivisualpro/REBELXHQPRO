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

    // Fetch all source data in parallel
    const [openingBalances, purchaseOrders, manufacturingJobs, adjustments] = await Promise.all([
        OpeningBalance.find({ sku: skuId })
            .select('lotNumber cost')
            .lean(),
        PurchaseOrder.find({ 'lineItems.sku': skuId })
            .select('lineItems.sku lineItems.lotNumber lineItems.cost lineItems.price lineItems.qtyReceived')
            .lean(),
        Manufacturing.find({ sku: skuId })
            .select('sku qty qtyDifference lotNumber label totalCost lineItems labor packagingCost status')
            .lean(),
        AuditAdjustment.find({ sku: skuId })
            .select('lotNumber cost')
            .lean(),
    ]);

    const lotCosts = new Map<string, number>();

    // Priority 1: Opening Balances
    (openingBalances as any[]).forEach((ob: any) => {
        const lot = cleanLot(ob.lotNumber);
        if (lot && ob.cost && !lotCosts.has(lot)) {
            lotCosts.set(lot, ob.cost);
        }
    });

    // Priority 2: Purchase Orders
    (purchaseOrders as any[]).forEach((po: any) => {
        po.lineItems?.forEach((line: any) => {
            const lineSkuId = (line.sku?._id || line.sku)?.toString();
            if (lineSkuId === skuId && line.qtyReceived > 0 && line.lotNumber) {
                const lot = cleanLot(line.lotNumber);
                const cost = line.cost || line.price || 0;
                if (lot && cost > 0 && !lotCosts.has(lot)) {
                    lotCosts.set(lot, cost);
                }
            }
        });
    });

    // Priority 3: Manufacturing
    // For manufactured items, we need ingredient costs to calculate costPerUnit
    // Collect ingredient SKU IDs
    const ingredientSkuIds = new Set<string>();
    ingredientSkuIds.add(skuId);
    (manufacturingJobs as any[]).forEach((job: any) => {
        const jobSkuId = (job.sku?._id || job.sku)?.toString();
        if (jobSkuId === skuId) {
            job.lineItems?.forEach((li: any) => {
                const liSkuId = (li.sku?._id || li.sku)?.toString();
                if (liSkuId) ingredientSkuIds.add(liSkuId);
            });
        }
    });

    // Fetch ingredient costs
    const [ingObs, ingPos] = await Promise.all([
        OpeningBalance.find({ sku: { $in: Array.from(ingredientSkuIds) } }).lean(),
        PurchaseOrder.find({ 'lineItems.sku': { $in: Array.from(ingredientSkuIds) } }).lean(),
    ]);

    const getIngredientCost = (iSkuId: string, lot: string): number => {
        const ob = (ingObs as any[]).find(o => o.sku?.toString() === iSkuId && o.lotNumber === lot);
        if (ob) return ob.cost || 0;
        for (const po of (ingPos as any[])) {
            const line = po.lineItems?.find((l: any) =>
                (l.sku?._id || l.sku)?.toString() === iSkuId && l.lotNumber === lot
            );
            if (line) return line.cost || line.price || 0;
        }
        return 0;
    };

    const durationToHours = (duration: string): number => {
        if (!duration) return 0;
        const parts = duration.split(':').map(p => parseFloat(p) || 0);
        if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
        if (parts.length === 2) return parts[0] + parts[1] / 60;
        return parts[0] || 0;
    };

    (manufacturingJobs as any[]).forEach((job: any) => {
        const jobSkuId = (job.sku?._id || job.sku)?.toString();
        if (jobSkuId !== skuId) return;

        const lot = cleanLot(job.lotNumber || job.label);
        if (!lot || lotCosts.has(lot)) return;

        let costPerUnit = 0;

        // Use stored totalCost if available
        if (job.totalCost && job.totalCost > 0) {
            const totalQtyProduced = (job.qty || 0) + (job.qtyDifference || 0);
            costPerUnit = totalQtyProduced > 0 ? job.totalCost / totalQtyProduced : 0;
        } else {
            // Calculate from components (materials + labor + packaging)
            let totalMatCost = 0;
            job.lineItems?.forEach((li: any) => {
                const liSkuId = (li.sku?._id || li.sku)?.toString();
                if (!liSkuId) return;
                const totalConsumed = ((li.recipeQty || 0) * (job.qty || 0)) + (li.qtyExtra || 0) + (li.qtyScrapped || 0);
                totalMatCost += totalConsumed * getIngredientCost(liSkuId, li.lotNumber);
            });

            let totalLaborCost = 0;
            job.labor?.forEach((l: any) => {
                totalLaborCost += durationToHours(l.duration) * (l.hourlyRate || 0);
            });

            const packagingCost = job.packagingCost || 0;
            const totalQtyProduced = (job.qty || 0) + (job.qtyDifference || 0);
            costPerUnit = totalQtyProduced > 0 ? (totalMatCost + totalLaborCost + packagingCost) / totalQtyProduced : 0;
        }

        lotCosts.set(lot, costPerUnit);
    });

    // Priority 4: Audit Adjustments
    (adjustments as any[]).forEach((adj: any) => {
        const lot = cleanLot(adj.lotNumber);
        if (lot && adj.cost && !lotCosts.has(lot)) {
            lotCosts.set(lot, adj.cost);
        }
    });

    // Cache the result
    lotCostCache.set(skuId, { data: lotCosts, timestamp: Date.now() });

    return lotCosts;
}
