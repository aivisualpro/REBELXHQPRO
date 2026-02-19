import dbConnect from '@/lib/mongoose';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import SaleOrder from '@/models/SaleOrder';
import WebOrder from '@/models/WebOrder';
import { getGlobalStartDate } from '@/lib/global-settings';

export interface LotInfo {
    lotNumber: string;
    balance: number;
    cost: number;
    date: Date;
    source: string;
}

/**
 * Get all lots for a SKU with accurate balances
 * 
 * IMPORTANT: 
 * - Only tracks lots that have SOURCE transactions (OB, PO, Manufacturing, positive Audit)
 * - Consumption transactions only DEDUCT from existing lots
 * - Respects the global filterDataFrom setting
 */
export async function getLotsWithBalances(skuId: string): Promise<LotInfo[]> {
    if (!skuId) return [];
    
    await dbConnect();
    
    // For Balance Calculation, we MUST fetch ALL history.
    // We cannot filter by date here, or we will miss original sources of inventory.
    // const startDate = await getGlobalStartDate();
    // const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};
    
    // Track lots with their source info - ONLY from source transactions
    const lotData = new Map<string, { balance: number; cost: number; date: Date; source: string }>();

    // Helper to normalize lot numbers
    const normalizeLot = (lot: string | undefined | null): string | null => {
        if (!lot || lot.trim() === '' || lot === 'N/A') return null;
        return lot.trim();
    };

    // ==================== PHASE 1: SOURCES (Create lot entries) ====================
    
    // 1. Opening Balances
    const obs = await OpeningBalance.find({ sku: skuId }).lean();
    obs.forEach((ob: any) => {
        const lot = normalizeLot(ob.lotNumber);
        if (!lot) return;
        
        const existing = lotData.get(lot);
        lotData.set(lot, {
            balance: (existing?.balance || 0) + (ob.qty || 0),
            cost: ob.cost || existing?.cost || 0,
            date: existing?.date || new Date(ob.createdAt),
            source: existing?.source || 'Opening Balance'
        });
    });

    // 2. Purchase Orders (Received)
    const pos = await PurchaseOrder.find({ 
        'lineItems.sku': skuId, 
        status: { $in: ['Received', 'received'] }
    }).lean();
    pos.forEach((po: any) => {
        po.lineItems?.forEach((li: any) => {
            if (li.sku?.toString() === skuId && li.qtyReceived > 0) {
                const lot = normalizeLot(li.lotNumber);
                if (!lot) return;
                
                const existing = lotData.get(lot);
                lotData.set(lot, {
                    balance: (existing?.balance || 0) + (li.qtyReceived || 0),
                    cost: li.cost || li.price || existing?.cost || 0,
                    date: existing?.date || new Date(li.receivedDate || po.createdAt),
                    source: existing?.source || 'Purchase Order'
                });
            }
        });
    });

    // 3. Manufacturing (Produced)
    // Skip Pending - they are shown in ledger but NOT counted towards balance
    const mfgProduced = await Manufacturing.find({ 
        sku: skuId
    }).lean();
    mfgProduced.forEach((mo: any) => {
        // Skip Pending productions - ledger excludes these from balance
        if (mo.status === 'Pending') return;
        
        const lot = normalizeLot(mo.lotNumber || mo.label);
        if (!lot) return;
        
        const totalQty = (mo.qty || 0) + (mo.qtyDifference || 0);
        if (totalQty <= 0) return;
        
        let costPerUnit = 0;
        if (mo.totalCost && mo.totalCost > 0 && totalQty > 0) {
            costPerUnit = mo.totalCost / totalQty;
        }
        
        const existing = lotData.get(lot);
        lotData.set(lot, {
            balance: (existing?.balance || 0) + totalQty,
            cost: costPerUnit || existing?.cost || 0,
            date: existing?.date || new Date(mo.scheduledFinish || mo.createdAt),
            source: existing?.source || 'Manufacturing'
        });
    });

    // 4. Audit Adjustments (can be + or -)
    // Positive adjustments CREATE lots if they don't exist
    // Negative adjustments only REDUCE existing lots
    const adjs = await AuditAdjustment.find({ sku: skuId }).lean();
    adjs.forEach((adj: any) => {
        const lot = normalizeLot(adj.lotNumber);
        if (!lot) return;
        
        const qty = adj.qty || 0;
        const existing = lotData.get(lot);
        
        // Only create new lot entry if this is a POSITIVE adjustment
        if (!existing && qty <= 0) return;
        
        lotData.set(lot, {
            balance: (existing?.balance || 0) + qty,
            cost: adj.cost || existing?.cost || 0,
            date: existing?.date || new Date(adj.createdAt),
            source: existing?.source || 'Audit Adjustment'
        });
    });

    // ==================== PHASE 2: CONSUMPTIONS (Only deduct from EXISTING lots) ====================

    // 5. Manufacturing (Consumed) - where this SKU is an INGREDIENT
    // Skip non-Fulfilled - ledger excludes unfulfilled consumption from balance
    const mfgConsumed = await Manufacturing.find({ 
        'lineItems.sku': skuId
    }).lean();
    mfgConsumed.forEach((mo: any) => {
        // Skip unfulfilled consumption - ledger excludes these from balance
        if (mo.status !== 'Fulfilled' && mo.status !== 'fulfilled') return;
        
        mo.lineItems?.forEach((li: any) => {
            const liSkuId = (typeof li.sku === 'object' && li.sku !== null) ? li.sku._id : li.sku;
            if (liSkuId?.toString() !== skuId) return;
            
            const lot = normalizeLot(li.lotNumber);
            if (!lot) return;
            
            // ONLY deduct if this lot exists in our source data
            const existing = lotData.get(lot);
            if (!existing) return;  // Skip - lot doesn't exist as a source
            
            // Match ledger's consumption formula: BOM + SA% + scrapped
            const orderQty = mo.qty || 0;
            const recipeQty = li.recipeQty || 0;
            const bomQty = orderQty * recipeQty;
            const saPercent = li.sa || 0;
            const saExtra = saPercent > 0 ? (bomQty / (saPercent / 100)) - bomQty : 0;
            const qtyScrapped = li.qtyScrapped || 0;
            const totalConsumed = bomQty + qtyScrapped + saExtra;
            
            if (totalConsumed > 0) {
                lotData.set(lot, {
                    ...existing,
                    balance: existing.balance - totalConsumed
                });
            }
        });
    });

    // 6. Sale Orders (Wholesale)
    // Ledger includes all sale orders - they use qtyShipped which is 0 for non-shipped
    const saleOrders = await SaleOrder.find({ 
        'lineItems.sku': skuId
    }).lean();
    saleOrders.forEach((so: any) => {
        so.lineItems?.forEach((li: any) => {
            if (li.sku?.toString() !== skuId) return;
            const qty = li.qtyShipped || li.qty || 0;
            if (qty <= 0) return;
            
            const lot = normalizeLot(li.lotNumber);
            if (!lot) return;
            
            // ONLY deduct if this lot exists in our source data
            const existing = lotData.get(lot);
            if (!existing) return;  // Skip - lot doesn't exist as a source
            
            lotData.set(lot, {
                ...existing,
                balance: existing.balance - Math.abs(qty)
            });
        });
    });

    // 7. Web Orders (Retail)
    // Ledger includes ALL web orders (no status filter) - they all deduct from stock
    const webOrders = await WebOrder.find({
        $or: [
            { 'lineItems.sku': skuId },
            { 'lineItems.linkedSkuId': skuId }
        ]
    }).lean();
    webOrders.forEach((wo: any) => {
        wo.lineItems?.forEach((li: any) => {
            const liSkuId = (typeof li.sku === 'object' && li.sku !== null) ? li.sku._id : li.sku;
            const isMatch = liSkuId?.toString() === skuId || li.linkedSkuId === skuId;
            if (!isMatch) return;
            
            const lot = normalizeLot(li.lotNumber);
            if (!lot) return;
            
            // ONLY deduct if this lot exists in our source data
            const existing = lotData.get(lot);
            if (!existing) return;  // Skip - lot doesn't exist as a source
            
            const qty = li.quantity || li.qty || 0;
            if (qty > 0) {
                lotData.set(lot, {
                    ...existing,
                    balance: existing.balance - qty
                });
            }
        });
    });

    // Convert to array and sort by date (FIFO - oldest first)
    const lots = Array.from(lotData.entries())
        .map(([lotNumber, data]) => ({
            lotNumber,
            balance: data.balance,
            cost: data.cost,
            date: data.date,
            source: data.source
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Apply Global Date Filter to the LIST OF LOTS (Visual Filtering)
    // We do this AFTER calculating balances to ensuring the numbers are correct.
    const startDate = await getGlobalStartDate();
    if (startDate) {
        return lots.filter(lot => new Date(lot.date) >= startDate);
    }
    
    return lots;
}

/**
 * Get the suggested lot for a SKU using FIFO (oldest lot with positive balance)
 */
export async function getSuggestedLotForSku(skuId: string): Promise<LotInfo | null> {
    const lots = await getLotsWithBalances(skuId);
    // Only return lots with POSITIVE balance
    const availableLots = lots.filter(lot => lot.balance > 0);
    return availableLots[0] || null;
}

/**
 * Get all lots with positive balance for a SKU (for lot selection UI)
 */
export async function getAvailableLotsForSku(skuId: string): Promise<LotInfo[]> {
    const lots = await getLotsWithBalances(skuId);
    // Only return lots with POSITIVE balance
    return lots.filter(lot => lot.balance > 0);
}

export interface LotTransaction {
    lotNumber: string;
    qty: number;
    cost: number;
    date: Date;
    source: string;
    isSource: boolean;
}

/**
 * Get all lot transactions for a SKU sorted by date
 * This is used for historical lot allocation - replaying history to find what lot was available on a specific date
 */
export async function getLotTransactions(skuId: string): Promise<LotTransaction[]> {
    if (!skuId) return [];
    
    await dbConnect();
    
    // Timeline Calculation MUST use full history.
    // const startDate = await getGlobalStartDate();
    // const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};
    
    const transactions: LotTransaction[] = [];
    
    const normalizeLot = (lot: string | undefined | null): string | null => {
        if (!lot || lot.trim() === '' || lot === 'N/A') return null;
        return lot.trim();
    };

    // 1. Opening Balances (SOURCE)
    const obs = await OpeningBalance.find({ sku: skuId }).lean();
    obs.forEach((ob: any) => {
        const lot = normalizeLot(ob.lotNumber);
        if (lot && ob.qty > 0) {
            transactions.push({
                lotNumber: lot,
                qty: ob.qty,
                cost: ob.cost || 0,
                date: new Date(ob.createdAt),
                source: 'Opening Balance',
                isSource: true
            });
        }
    });

    // 2. Purchase Orders (SOURCE)
    const pos = await PurchaseOrder.find({ 
        'lineItems.sku': skuId, 
        status: { $in: ['Received', 'received'] }
    }).lean();
    pos.forEach((po: any) => {
        po.lineItems?.forEach((li: any) => {
            if (li.sku?.toString() === skuId && li.qtyReceived > 0) {
                const lot = normalizeLot(li.lotNumber);
                if (lot) {
                    transactions.push({
                        lotNumber: lot,
                        qty: li.qtyReceived,
                        cost: li.cost || li.price || 0,
                        date: new Date(li.receivedDate || po.createdAt),
                        source: 'Purchase Order',
                        isSource: true
                    });
                }
            }
        });
    });

    // 3. Manufacturing Produced (SOURCE)
    const mfgProduced = await Manufacturing.find({ 
        sku: skuId, 
        status: { $in: ['Completed', 'completed', 'Fulfilled', 'fulfilled'] }
    }).lean();
    mfgProduced.forEach((mo: any) => {
        const lot = normalizeLot(mo.lotNumber || mo.label);
        const totalQty = (mo.qty || 0) + (mo.qtyDifference || 0);
        if (lot && totalQty > 0) {
            let costPerUnit = 0;
            if (mo.totalCost && mo.totalCost > 0 && totalQty > 0) {
                costPerUnit = mo.totalCost / totalQty;
            }
            transactions.push({
                lotNumber: lot,
                qty: totalQty,
                cost: costPerUnit,
                date: new Date(mo.scheduledFinish || mo.createdAt),
                source: 'Manufacturing',
                isSource: true
            });
        }
    });

    // 4. Audit Adjustments (can be source or consumption)
    const adjs = await AuditAdjustment.find({ sku: skuId }).lean();
    adjs.forEach((adj: any) => {
        const lot = normalizeLot(adj.lotNumber);
        if (lot && adj.qty !== 0) {
            transactions.push({
                lotNumber: lot,
                qty: adj.qty,
                cost: adj.cost || 0,
                date: new Date(adj.createdAt),
                source: 'Audit Adjustment',
                isSource: adj.qty > 0
            });
        }
    });

    // 5. Sale Orders (CONSUMPTION)
    const saleOrders = await SaleOrder.find({ 
        'lineItems.sku': skuId,
        status: { $in: ['Shipped', 'shipped', 'Completed', 'completed'] }
    }).lean();
    saleOrders.forEach((so: any) => {
        so.lineItems?.forEach((li: any) => {
            if (li.sku?.toString() === skuId && li.qtyShipped > 0) {
                const lot = normalizeLot(li.lotNumber);
                if (lot) {
                    transactions.push({
                        lotNumber: lot,
                        qty: -Math.abs(li.qtyShipped),
                        cost: 0,
                        date: new Date(so.shippedDate || so.createdAt),
                        source: 'Sale Order',
                        isSource: false
                    });
                }
            }
        });
    });

    // 6. Web Orders (CONSUMPTION) - only those with lotNumber assigned
    const webOrders = await WebOrder.find({
        $or: [
            { 'lineItems.sku': skuId },
            { 'lineItems.linkedSkuId': skuId }
        ],
        status: { $in: ['completed', 'shipped', 'Completed', 'Shipped'] }
    }).lean();
    webOrders.forEach((wo: any) => {
        wo.lineItems?.forEach((li: any) => {
            const liSkuId = (typeof li.sku === 'object' && li.sku !== null) ? li.sku._id : li.sku;
            const isMatch = liSkuId?.toString() === skuId || li.linkedSkuId === skuId;
            if (isMatch && li.lotNumber) {
                const lot = normalizeLot(li.lotNumber);
                const qty = li.quantity || li.qty || 0;
                if (lot && qty > 0) {
                    transactions.push({
                        lotNumber: lot,
                        qty: -qty,
                        cost: 0,
                        date: new Date(wo.dateCompleted || wo.createdAt),
                        source: 'Web Order',
                        isSource: false
                    });
                }
            }
        });
    });

    // Sort by date (oldest first)
    return transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Calculate lot availability as of a specific date
 * This replays history up to the given date to find what lots were available at that point
 * @param skuId The SKU to check
 * @param asOfDate The date to calculate availability for
 * @returns Array of lots with their balances as of that date
 */
export async function getLotsAsOfDate(skuId: string, asOfDate: Date): Promise<LotInfo[]> {
    const transactions = await getLotTransactions(skuId);
    
    // Filter transactions up to the given date
    const relevantTx = transactions.filter(tx => tx.date <= asOfDate);
    
    // Calculate balances
    const lotData = new Map<string, { balance: number; cost: number; date: Date; source: string }>();
    
    for (const tx of relevantTx) {
        const existing = lotData.get(tx.lotNumber);
        
        // Only create lot entry if this is a source transaction (for new lots)
        if (!existing && !tx.isSource) continue;
        
        lotData.set(tx.lotNumber, {
            balance: (existing?.balance || 0) + tx.qty,
            cost: tx.isSource && tx.cost > 0 ? tx.cost : (existing?.cost || 0),
            date: tx.isSource && !existing?.date ? tx.date : (existing?.date || tx.date),
            source: tx.isSource && !existing?.source ? tx.source : (existing?.source || tx.source)
        });
    }
    
    // Convert to array, filter positive balances, sort by date (FIFO)
    return Array.from(lotData.entries())
        .map(([lotNumber, data]) => ({
            lotNumber,
            balance: data.balance,
            cost: data.cost,
            date: data.date,
            source: data.source
        }))
        .filter(lot => lot.balance > 0)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get the FIFO lot that was available on a specific date
 */
export async function getSuggestedLotForDate(skuId: string, asOfDate: Date): Promise<LotInfo | null> {
    const lots = await getLotsAsOfDate(skuId, asOfDate);
    return lots[0] || null;
}
