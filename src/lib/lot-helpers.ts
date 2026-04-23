import mongoose from 'mongoose';
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
    const normalizeLot = (lot: any): string | null => {
        if (lot === null || lot === undefined) return null;
        let s = String(lot).trim();
        // Strip locale formatting (commas) and trailing decimal zeros
        s = s.replace(/,/g, '').replace(/\.0+$/, '');
        if (s === '' || s === 'N/A') return null;
        return s;
    };

    // ==================== PHASE 1: SOURCES (Create lot entries) ====================
    
    const objId = new mongoose.Types.ObjectId(skuId);

    const timePipeline = async (name: string, promise: any) => {
        console.time(name);
        const res = await promise;
        console.timeEnd(name);
        return res;
    };

    console.time('getLotsWithBalances-PromiseAll');
    // Fetch and aggregate all sources and consumptions directly in the database
    // This prevents pulling thousands of massive documents into Node.js memory
    const [obs, pos, mfgProduced, adjs, mfgConsumed, saleOrders, webOrders] = await Promise.all([
        // 1. Opening Balances
        timePipeline('pipeline-OpeningBalance', OpeningBalance.aggregate([
            { $match: { sku: objId } },
            { $sort: { createdAt: 1 } },
            { $group: { 
                _id: "$lotNumber", 
                qty: { $sum: "$qty" }, 
                costs: { $push: { $cond: [{ $and: [{ $ne: ["$cost", null] }, { $ne: ["$cost", 0] }] }, "$cost", null] } }, 
                date: { $first: "$createdAt" } 
            } },
            { $addFields: {
                cost: {
                    $let: {
                        vars: { filteredCosts: { $filter: { input: "$costs", as: "c", cond: { $ne: ["$$c", null] } } } },
                        in: { $cond: [{ $gt: [{ $size: "$$filteredCosts" }, 0] }, { $arrayElemAt: ["$$filteredCosts", -1] }, 0] }
                    }
                }
            }},
            { $project: { costs: 0 } }
        ])),
        
        // 2. Purchase Orders
        timePipeline('pipeline-PurchaseOrder', PurchaseOrder.aggregate([
            { $match: { "lineItems.sku": objId, status: { $regex: /^received$/i } } },
            { $unwind: "$lineItems" },
            { $match: { "lineItems.sku": objId, "lineItems.qtyReceived": { $gt: 0 } } },
            { $sort: { createdAt: 1 } },
            { $group: { 
                _id: "$lineItems.lotNumber", 
                qty: { $sum: "$lineItems.qtyReceived" }, 
                costs: { $push: { 
                    $let: {
                        vars: { rawCost: { $ifNull: ["$lineItems.cost", "$lineItems.price"] } },
                        in: { $cond: [{ $and: [{ $ne: ["$$rawCost", null] }, { $ne: ["$$rawCost", 0] }] }, "$$rawCost", null] }
                    }
                }}, 
                date: { $first: { $ifNull: ["$lineItems.receivedDate", "$createdAt"] } } 
            }},
            { $addFields: {
                cost: {
                    $let: {
                        vars: { filteredCosts: { $filter: { input: "$costs", as: "c", cond: { $ne: ["$$c", null] } } } },
                        in: { $cond: [{ $gt: [{ $size: "$$filteredCosts" }, 0] }, { $arrayElemAt: ["$$filteredCosts", -1] }, 0] }
                    }
                }
            }},
            { $project: { costs: 0 } }
        ])),

        // 3. Manufacturing Produced
        timePipeline('pipeline-ManufacturingProduced', Manufacturing.aggregate([
            { $match: { sku: objId, status: { $nin: [/pending/i, /processing/i] } } },
            { $sort: { createdAt: 1 } },
            { $group: {
                _id: { $ifNull: ["$lotNumber", "$label"] },
                qty: { $sum: { $add: [{ $ifNull: ["$qty", 0] }, { $ifNull: ["$qtyDifference", 0] }] } },
                costs: { $push: { $cond: [{ $and: [{ $ne: ["$totalCost", null] }, { $ne: ["$totalCost", 0] }] }, "$totalCost", null] } }, 
                date: { $first: { $ifNull: ["$scheduledFinish", "$createdAt"] } }
            }},
            { $addFields: {
                cost: {
                    $let: {
                        vars: { filteredCosts: { $filter: { input: "$costs", as: "c", cond: { $ne: ["$$c", null] } } } },
                        in: { $cond: [{ $gt: [{ $size: "$$filteredCosts" }, 0] }, { $arrayElemAt: ["$$filteredCosts", -1] }, 0] }
                    }
                }
            }},
            { $project: { costs: 0 } }
        ])),

        // 4. Audit Adjustments
        timePipeline('pipeline-AuditAdjustment', AuditAdjustment.aggregate([
            { $match: { sku: objId } },
            { $sort: { createdAt: 1 } },
            { $group: { 
                _id: "$lotNumber", 
                qty: { $sum: "$qty" }, 
                costs: { $push: { $cond: [{ $and: [{ $ne: ["$cost", null] }, { $ne: ["$cost", 0] }] }, "$cost", null] } }, 
                date: { $first: "$createdAt" } 
            }},
            { $addFields: {
                cost: {
                    $let: {
                        vars: { filteredCosts: { $filter: { input: "$costs", as: "c", cond: { $ne: ["$$c", null] } } } },
                        in: { $cond: [{ $gt: [{ $size: "$$filteredCosts" }, 0] }, { $arrayElemAt: ["$$filteredCosts", -1] }, 0] }
                    }
                }
            }},
            { $project: { costs: 0 } }
        ])),

        // 5. Manufacturing Consumed
        timePipeline('pipeline-ManufacturingConsumed', Manufacturing.aggregate([
            { $match: { "lineItems.sku": objId, status: { $regex: /^fulfilled$/i } } },
            { $unwind: "$lineItems" },
            { $match: { "lineItems.sku": objId } },
            { $group: {
                _id: "$lineItems.lotNumber",
                // Passing raw arrays up to JS because formula calculation (saExtra) is complex
                consumptions: { $push: { orderQty: "$qty", recipeQty: "$lineItems.recipeQty", sa: "$lineItems.sa", qtyScrapped: "$lineItems.qtyScrapped" } }
            }}
        ])),

        // 6. Sale Orders Consumed
        timePipeline('pipeline-SaleOrder', SaleOrder.aggregate([
            { $match: { "lineItems.sku": objId } },
            { $unwind: "$lineItems" },
            { $match: { "lineItems.sku": objId } },
            { $group: { 
                _id: "$lineItems.lotNumber", 
                qtyShipped: { $sum: { 
                    $cond: [
                        { $and: [{ $ne: ["$lineItems.qtyShipped", null] }, { $ne: ["$lineItems.qtyShipped", 0] }] }, 
                        "$lineItems.qtyShipped", 
                        { $ifNull: ["$lineItems.qty", 0] }
                    ]
                } } 
            } }
        ])),

        // 7. Web Orders Consumed
        timePipeline('pipeline-WebOrder', WebOrder.aggregate([
            { $match: { $or: [{ "lineItems.sku": objId }, { "lineItems.linkedSkuId": skuId }] } },
            { $unwind: "$lineItems" },
            { $match: { $or: [{ "lineItems.sku": objId }, { "lineItems.linkedSkuId": skuId }] } },
            { $group: { 
                _id: "$lineItems.lotNumber", 
                qty: { $sum: { 
                    $cond: [
                        { $and: [{ $ne: ["$lineItems.quantity", null] }, { $ne: ["$lineItems.quantity", 0] }] }, 
                        "$lineItems.quantity", 
                        { $ifNull: ["$lineItems.qty", 0] }
                    ]
                } } 
            } }
        ]))
    ]);
    console.timeEnd('getLotsWithBalances-PromiseAll');

    // Reconstruct lotData Map from optimized db results
    obs.forEach((ob: any) => {
        const lot = normalizeLot(ob._id);
        if (lot) lotData.set(lot, { balance: ob.qty, cost: ob.cost || 0, date: ob.date, source: 'Opening Balance' });
    });

    pos.forEach((po: any) => {
        const lot = normalizeLot(po._id);
        if (lot) {
            const ex = lotData.get(lot);
            lotData.set(lot, { balance: (ex?.balance || 0) + po.qty, cost: po.cost || ex?.cost || 0, date: ex?.date || po.date, source: ex?.source || 'Purchase Order' });
        }
    });

    mfgProduced.forEach((mo: any) => {
        const lot = normalizeLot(mo._id);
        if (lot && mo.qty > 0) {
            const costPerUnit = mo.cost > 0 ? mo.cost / mo.qty : 0;
            const ex = lotData.get(lot);
            lotData.set(lot, { balance: (ex?.balance || 0) + mo.qty, cost: costPerUnit || ex?.cost || 0, date: ex?.date || mo.date, source: ex?.source || 'Manufacturing' });
        }
    });

    adjs.forEach((adj: any) => {
        const lot = normalizeLot(adj._id);
        if (lot) {
            const ex = lotData.get(lot);
            if (!ex && adj.qty <= 0) return;
            lotData.set(lot, { balance: (ex?.balance || 0) + adj.qty, cost: adj.cost || ex?.cost || 0, date: ex?.date || adj.date, source: ex?.source || 'Audit Adjustment' });
        }
    });

    // ==================== PHASE 2: CONSUMPTIONS (Only deduct from EXISTING lots) ====================
    mfgConsumed.forEach((mo: any) => {
        const lot = normalizeLot(mo._id);
        const ex = lot ? lotData.get(lot) : null;
        if (lot && ex) {
            let totalConsumed = 0;
            mo.consumptions.forEach((c: any) => {
                const bomQty = (c.orderQty || 0) * (c.recipeQty || 0);
                const saExtra = (c.sa || 0) > 0 ? (bomQty / (c.sa / 100)) - bomQty : 0;
                totalConsumed += bomQty + (c.qtyScrapped || 0) + saExtra;
            });
            lotData.set(lot, { ...ex, balance: ex.balance - totalConsumed });
        }
    });

    saleOrders.forEach((so: any) => {
        const lot = normalizeLot(so._id);
        const ex = lot ? lotData.get(lot) : null;
        if (lot && ex && so.qtyShipped > 0) {
            lotData.set(lot, { ...ex, balance: ex.balance - Math.abs(so.qtyShipped) });
        }
    });

    webOrders.forEach((wo: any) => {
        const lot = normalizeLot(wo._id);
        const ex = lot ? lotData.get(lot) : null;
        if (lot && ex && wo.qty > 0) {
            lotData.set(lot, { ...ex, balance: ex.balance - wo.qty });
        }
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
    const objId = new mongoose.Types.ObjectId(skuId);
    
    const [obs, pos, mfgProduced, adjs, saleOrders, webOrders] = await Promise.all([
        OpeningBalance.aggregate([
            { $match: { sku: objId } },
            { $match: { qty: { $gt: 0 } } },
            { $project: { lotNumber: 1, qty: 1, cost: { $ifNull: ["$cost", 0] }, date: "$createdAt", source: { $literal: "Opening Balance" }, isSource: { $literal: true } } }
        ]),
        PurchaseOrder.aggregate([
            { $match: { "lineItems.sku": objId, status: { $regex: /^received$/i } } },
            { $unwind: "$lineItems" },
            { $match: { "lineItems.sku": objId, "lineItems.qtyReceived": { $gt: 0 } } },
            { $project: {
                lotNumber: "$lineItems.lotNumber",
                qty: "$lineItems.qtyReceived",
                cost: { $cond: [{ $and: [{ $ne: ["$lineItems.cost", null] }, { $ne: ["$lineItems.cost", 0] }] }, "$lineItems.cost", { $ifNull: ["$lineItems.price", 0] }] },
                date: { $ifNull: ["$lineItems.receivedDate", "$createdAt"] },
                source: { $literal: "Purchase Order" },
                isSource: { $literal: true }
            }}
        ]),
        Manufacturing.aggregate([
            { $match: { sku: objId, status: { $in: ['Completed', 'completed', 'Fulfilled', 'fulfilled'] } } },
            { $addFields: { totalQty: { $add: [{ $ifNull: ["$qty", 0] }, { $ifNull: ["$qtyDifference", 0] }] } } },
            { $match: { totalQty: { $gt: 0 } } },
            { $project: {
                lotNumber: { $ifNull: ["$lotNumber", "$label"] },
                qty: "$totalQty",
                cost: { $cond: [{ $gt: ["$totalQty", 0] }, { $divide: [{ $ifNull: ["$totalCost", 0] }, "$totalQty"] }, 0] },
                date: { $ifNull: ["$scheduledFinish", "$createdAt"] },
                source: { $literal: "Manufacturing" },
                isSource: { $literal: true }
            }}
        ]),
        AuditAdjustment.aggregate([
            { $match: { sku: objId } },
            { $match: { qty: { $ne: 0 } } },
            { $project: {
                lotNumber: 1,
                qty: 1,
                cost: { $ifNull: ["$cost", 0] },
                date: "$createdAt",
                source: { $literal: "Audit Adjustment" },
                isSource: { $gt: ["$qty", 0] }
            }}
        ]),
        SaleOrder.aggregate([
            { $match: { "lineItems.sku": objId, orderStatus: { $regex: /^(shipped|completed)$/i } } },
            { $unwind: "$lineItems" },
            { $match: { "lineItems.sku": objId, "lineItems.qtyShipped": { $gt: 0 } } },
            { $project: {
                lotNumber: "$lineItems.lotNumber",
                qty: { $multiply: [{ $abs: "$lineItems.qtyShipped" }, -1] },
                cost: { $literal: 0 },
                date: { $ifNull: ["$shippedDate", "$createdAt"] },
                source: { $literal: "Sale Order" },
                isSource: { $literal: false }
            }}
        ]),
        WebOrder.aggregate([
            { $match: { $or: [{ "lineItems.sku": objId }, { "lineItems.linkedSkuId": skuId }], status: { $regex: /^(shipped|completed)$/i } } },
            { $unwind: "$lineItems" },
            { $match: { $or: [{ "lineItems.sku": objId }, { "lineItems.linkedSkuId": skuId }] } },
            { $addFields: {
                resolvedQty: {
                    $cond: [
                        { $and: [{ $ne: ["$lineItems.quantity", null] }, { $ne: ["$lineItems.quantity", 0] }] },
                        "$lineItems.quantity",
                        { $ifNull: ["$lineItems.qty", 0] }
                    ]
                }
            }},
            { $match: { resolvedQty: { $gt: 0 } } },
            { $project: {
                lotNumber: "$lineItems.lotNumber",
                qty: { $multiply: ["$resolvedQty", -1] },
                cost: { $literal: 0 },
                date: { $ifNull: ["$dateCompleted", "$createdAt"] },
                source: { $literal: "Web Order" },
                isSource: { $literal: false }
            }}
        ])
    ]);

    const normalizeLot = (lot: any): string | null => {
        if (lot === null || lot === undefined) return null;
        let s = String(lot).trim();
        s = s.replace(/,/g, '').replace(/\.0+$/, '');
        if (s === '' || s === 'N/A') return null;
        return s;
    };

    const transactions: LotTransaction[] = [];
    
    [...obs, ...pos, ...mfgProduced, ...adjs, ...saleOrders, ...webOrders].forEach((tx: any) => {
        const lot = normalizeLot(tx.lotNumber);
        if (lot) {
            transactions.push({
                lotNumber: lot,
                qty: tx.qty,
                cost: tx.cost,
                date: new Date(tx.date),
                source: tx.source,
                isSource: tx.isSource
            });
        }
    });

    // Sort by date (oldest first)
    return transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Calculate lot availability as of a specific date
 * This replays history up to the given date to find what lots were available at that point
 */
export async function getLotsAsOfDate(skuId: string, asOfDate: Date): Promise<LotInfo[]> {
    if (!skuId) return [];
    
    await dbConnect();
    const objId = new mongoose.Types.ObjectId(skuId);

    const [obs, pos, mfgProduced, adjs, mfgConsumed, saleOrders, webOrders] = await Promise.all([
        OpeningBalance.aggregate([
            { $match: { sku: objId, createdAt: { $lte: asOfDate } } },
            { $sort: { createdAt: 1 } },
            { $group: { 
                _id: "$lotNumber", 
                qty: { $sum: "$qty" }, 
                costs: { $push: { $cond: [{ $and: [{ $ne: ["$cost", null] }, { $ne: ["$cost", 0] }] }, "$cost", null] } }, 
                date: { $first: "$createdAt" } 
            } },
            { $addFields: {
                cost: {
                    $let: {
                        vars: { filteredCosts: { $filter: { input: "$costs", as: "c", cond: { $ne: ["$$c", null] } } } },
                        in: { $cond: [{ $gt: [{ $size: "$$filteredCosts" }, 0] }, { $arrayElemAt: ["$$filteredCosts", -1] }, 0] }
                    }
                }
            }},
            { $project: { costs: 0 } }
        ]),
        PurchaseOrder.aggregate([
            { $match: { "lineItems.sku": objId, status: { $regex: /^received$/i } } },
            { $addFields: { resolvedDate: { $ifNull: ["$receivedDate", "$createdAt"] } } },
            { $unwind: "$lineItems" },
            { $addFields: { lineResolvedDate: { $ifNull: ["$lineItems.receivedDate", "$resolvedDate"] } } },
            { $match: { "lineItems.sku": objId, "lineItems.qtyReceived": { $gt: 0 }, lineResolvedDate: { $lte: asOfDate } } },
            { $sort: { createdAt: 1 } },
            { $group: { 
                _id: "$lineItems.lotNumber", 
                qty: { $sum: "$lineItems.qtyReceived" }, 
                costs: { $push: { 
                    $let: {
                        vars: { rawCost: { $ifNull: ["$lineItems.cost", "$lineItems.price"] } },
                        in: { $cond: [{ $and: [{ $ne: ["$$rawCost", null] }, { $ne: ["$$rawCost", 0] }] }, "$$rawCost", null] }
                    }
                }}, 
                date: { $first: "$lineResolvedDate" } 
            }},
            { $addFields: {
                cost: {
                    $let: {
                        vars: { filteredCosts: { $filter: { input: "$costs", as: "c", cond: { $ne: ["$$c", null] } } } },
                        in: { $cond: [{ $gt: [{ $size: "$$filteredCosts" }, 0] }, { $arrayElemAt: ["$$filteredCosts", -1] }, 0] }
                    }
                }
            }},
            { $project: { costs: 0 } }
        ]),
        Manufacturing.aggregate([
            { $match: { sku: objId, status: { $nin: [/pending/i, /processing/i] } } },
            { $addFields: { resolvedDate: { $ifNull: ["$scheduledFinish", "$createdAt"] } } },
            { $match: { resolvedDate: { $lte: asOfDate } } },
            { $sort: { createdAt: 1 } },
            { $group: {
                _id: { $ifNull: ["$lotNumber", "$label"] },
                qty: { $sum: { $add: [{ $ifNull: ["$qty", 0] }, { $ifNull: ["$qtyDifference", 0] }] } },
                costs: { $push: { $cond: [{ $and: [{ $ne: ["$totalCost", null] }, { $ne: ["$totalCost", 0] }] }, "$totalCost", null] } }, 
                date: { $first: "$resolvedDate" }
            }},
            { $addFields: {
                cost: {
                    $let: {
                        vars: { filteredCosts: { $filter: { input: "$costs", as: "c", cond: { $ne: ["$$c", null] } } } },
                        in: { $cond: [{ $gt: [{ $size: "$$filteredCosts" }, 0] }, { $arrayElemAt: ["$$filteredCosts", -1] }, 0] }
                    }
                }
            }},
            { $project: { costs: 0 } }
        ]),
        AuditAdjustment.aggregate([
            { $match: { sku: objId, createdAt: { $lte: asOfDate } } },
            { $sort: { createdAt: 1 } },
            { $group: { 
                _id: "$lotNumber", 
                qty: { $sum: "$qty" }, 
                costs: { $push: { $cond: [{ $and: [{ $ne: ["$cost", null] }, { $ne: ["$cost", 0] }] }, "$cost", null] } }, 
                date: { $first: "$createdAt" } 
            }},
            { $addFields: {
                cost: {
                    $let: {
                        vars: { filteredCosts: { $filter: { input: "$costs", as: "c", cond: { $ne: ["$$c", null] } } } },
                        in: { $cond: [{ $gt: [{ $size: "$$filteredCosts" }, 0] }, { $arrayElemAt: ["$$filteredCosts", -1] }, 0] }
                    }
                }
            }},
            { $project: { costs: 0 } }
        ]),
        Manufacturing.aggregate([
            { $match: { "lineItems.sku": objId, status: { $regex: /^fulfilled$/i } } },
            { $addFields: { resolvedDate: { $ifNull: ["$createdAt", "$createdAt"] } } },
            { $match: { resolvedDate: { $lte: asOfDate } } },
            { $unwind: "$lineItems" },
            { $match: { "lineItems.sku": objId } },
            { $group: {
                _id: "$lineItems.lotNumber",
                consumptions: { $push: { orderQty: "$qty", recipeQty: "$lineItems.recipeQty", sa: "$lineItems.sa", qtyScrapped: "$lineItems.qtyScrapped" } }
            }}
        ]),
        SaleOrder.aggregate([
            { $match: { "lineItems.sku": objId } },
            { $addFields: { resolvedDate: { $ifNull: ["$shippedDate", "$createdAt"] } } },
            { $match: { resolvedDate: { $lte: asOfDate } } },
            { $unwind: "$lineItems" },
            { $match: { "lineItems.sku": objId } },
            { $group: { 
                _id: "$lineItems.lotNumber", 
                qtyShipped: { $sum: { 
                    $cond: [
                        { $and: [{ $ne: ["$lineItems.qtyShipped", null] }, { $ne: ["$lineItems.qtyShipped", 0] }] }, 
                        "$lineItems.qtyShipped", 
                        { $ifNull: ["$lineItems.qty", 0] }
                    ]
                } } 
            } }
        ]),
        WebOrder.aggregate([
            { $match: { $or: [{ "lineItems.sku": objId }, { "lineItems.linkedSkuId": skuId }] } },
            { $addFields: { resolvedDate: { $ifNull: ["$dateCompleted", "$createdAt"] } } },
            { $match: { resolvedDate: { $lte: asOfDate } } },
            { $unwind: "$lineItems" },
            { $match: { $or: [{ "lineItems.sku": objId }, { "lineItems.linkedSkuId": skuId }] } },
            { $group: { 
                _id: "$lineItems.lotNumber", 
                qty: { $sum: { 
                    $cond: [
                        { $and: [{ $ne: ["$lineItems.quantity", null] }, { $ne: ["$lineItems.quantity", 0] }] }, 
                        "$lineItems.quantity", 
                        { $ifNull: ["$lineItems.qty", 0] }
                    ]
                } } 
            } }
        ])
    ]);

    const normalizeLot = (lot: any): string | null => {
        if (lot === null || lot === undefined) return null;
        let s = String(lot).trim();
        s = s.replace(/,/g, '').replace(/\.0+$/, '');
        if (s === '' || s === 'N/A') return null;
        return s;
    };

    const lotData = new Map<string, LotInfo>();

    obs.forEach((ob: any) => {
        const lot = normalizeLot(ob._id);
        if (lot) {
            lotData.set(lot, {
                lotNumber: lot,
                balance: ob.qty || 0,
                cost: ob.cost || 0,
                date: new Date(ob.date || new Date()),
                source: 'Opening Balance'
            });
        }
    });

    pos.forEach((po: any) => {
        const lot = normalizeLot(po._id);
        if (lot) {
            const existing = lotData.get(lot);
            lotData.set(lot, {
                lotNumber: lot,
                balance: (existing?.balance || 0) + (po.qty || 0),
                cost: po.cost || existing?.cost || 0,
                date: existing?.date || new Date(po.date || new Date()),
                source: existing?.source || 'Purchase Order'
            });
        }
    });

    mfgProduced.forEach((mo: any) => {
        const lot = normalizeLot(mo._id);
        if (lot) {
            const existing = lotData.get(lot);
            const totalQty = mo.qty || 0;
            const costPerUnit = mo.cost && mo.cost > 0 && totalQty > 0 ? (mo.cost / totalQty) : 0;
            lotData.set(lot, {
                lotNumber: lot,
                balance: (existing?.balance || 0) + totalQty,
                cost: costPerUnit || existing?.cost || 0,
                date: existing?.date || new Date(mo.date || new Date()),
                source: existing?.source || 'Manufacturing'
            });
        }
    });

    adjs.forEach((adj: any) => {
        const lot = normalizeLot(adj._id);
        if (lot) {
            const existing = lotData.get(lot);
            lotData.set(lot, {
                lotNumber: lot,
                balance: (existing?.balance || 0) + (adj.qty || 0),
                cost: adj.cost || existing?.cost || 0,
                date: existing?.date || new Date(adj.date || new Date()),
                source: existing?.source || 'Audit Adjustment'
            });
        }
    });

    mfgConsumed.forEach((mo: any) => {
        const lot = normalizeLot(mo._id);
        const ex = lot ? lotData.get(lot) : null;
        if (lot && ex) {
            let totalConsumed = 0;
            mo.consumptions.forEach((c: any) => {
                const bomQty = (c.orderQty || 0) * (c.recipeQty || 0);
                const saExtra = (c.sa || 0) > 0 ? (bomQty / (c.sa / 100)) - bomQty : 0;
                totalConsumed += bomQty + (c.qtyScrapped || 0) + saExtra;
            });
            lotData.set(lot, { ...ex, balance: ex.balance - totalConsumed });
        }
    });

    saleOrders.forEach((so: any) => {
        const lot = normalizeLot(so._id);
        const ex = lot ? lotData.get(lot) : null;
        if (lot && ex && so.qtyShipped > 0) {
            lotData.set(lot, { ...ex, balance: ex.balance - Math.abs(so.qtyShipped) });
        }
    });

    webOrders.forEach((wo: any) => {
        const lot = normalizeLot(wo._id);
        const ex = lot ? lotData.get(lot) : null;
        if (lot && ex && wo.qty > 0) {
            lotData.set(lot, { ...ex, balance: ex.balance - wo.qty });
        }
    });

    return Array.from(lotData.values())
        .filter(lot => lot.balance > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Get the FIFO lot that was available on a specific date
 */
export async function getSuggestedLotForDate(skuId: string, asOfDate: Date): Promise<LotInfo | null> {
    const lots = await getLotsAsOfDate(skuId, asOfDate);
    return lots[0] || null;
}
