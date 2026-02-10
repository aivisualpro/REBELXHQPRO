import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import Client from '@/models/Client';
import { deleteOrderFromAppSheet, syncPaymentToAppSheet, syncOrderLineItemToAppSheet } from '@/lib/appsheet';


export const dynamic = 'force-dynamic';

/**
 * Manual SKU populate for line items.
 * Mongoose's built-in populate fails due to BSON type mismatch:
 * - Sku model declares _id as String
 * - DB stores _id as ObjectId
 * This helper bypasses Mongoose and uses the native driver with $or queries.
 */
async function manualPopulateSkus(order: any) {
    if (!order?.lineItems?.length) return order;
    
    const db = mongoose.connection.db;
    if (!db) return order;
    
    // Collect unique SKU IDs from line items
    const skuIds = new Set<string>();
    for (const item of order.lineItems) {
        if (item.sku) {
            skuIds.add(item.sku.toString());
        }
    }
    
    if (skuIds.size === 0) return order;
    
    // Build $or query with both String and ObjectId types for each ID
    const orConditions: any[] = [];
    for (const id of skuIds) {
        orConditions.push({ _id: id }); // String match
        if (/^[0-9a-fA-F]{24}$/.test(id)) {
            orConditions.push({ _id: new mongoose.Types.ObjectId(id) }); // ObjectId match
        }
    }
    
    const skuDocs = await db.collection('skus').find(
        { $or: orConditions },
        { projection: { _id: 1, name: 1, legacyId: 1 } }
    ).toArray();
    
    // Build lookup map: string ID -> { _id, name }
    const skuMap = new Map<string, any>();
    for (const doc of skuDocs) {
        skuMap.set(doc._id.toString(), { _id: doc._id.toString(), name: doc.name, legacyId: doc.legacyId });
    }
    
    // Replace sku references with populated objects
    order.lineItems = order.lineItems.map((item: any) => {
        if (item.sku) {
            const skuIdStr = item.sku.toString();
            const skuDoc = skuMap.get(skuIdStr);
            return { ...item, sku: skuDoc || item.sku }; // Keep original ref if not found
        }
        return item;
    });
    
    return order;
}

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

        let order = await SaleOrder.findById(id)
            .populate('clientId', 'name addresses phones emails contacts salesPerson description website facebookPage industry forecastedAmount defaultPaymentMethod defaultShippingTerms contactStatus contactType billing')
            .lean();

        // Manual SKU populate (bypasses Mongoose's String vs ObjectId type mismatch)
        order = await manualPopulateSkus(order);

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

        // Capture existing data before update (for detecting new/deleted items)
        let existingPaymentIds: string[] = [];
        let existingPayments: any[] = [];
        let existingLineItemIds: string[] = [];
        let existingLineItems: any[] = [];
        let existingOrderData: any = null;

        const needsSnapshot = (body.payments && Array.isArray(body.payments)) || (body.lineItems && Array.isArray(body.lineItems));
        if (needsSnapshot) {
            const existingOrder = await SaleOrder.findById(id).select('payments lineItems label legacyId').lean();
            if (existingOrder) {
                existingOrderData = existingOrder;
                if (existingOrder.payments) {
                    existingPaymentIds = existingOrder.payments.map((p: any) => p._id?.toString());
                    existingPayments = existingOrder.payments;
                }
                if (existingOrder.lineItems) {
                    existingLineItemIds = existingOrder.lineItems.map((li: any) => li._id?.toString());
                    existingLineItems = existingOrder.lineItems;
                }
            }
        }

        if (body.lineItems && Array.isArray(body.lineItems)) {
            body.lineItems = body.lineItems.map((item: any) => {
                const cleaned = {
                    ...item,
                    total: (item.qtyShipped || 0) * (item.price || 0)
                };
                // Strip client-generated string _ids for new entries (same as payments)
                if (cleaned._id && typeof cleaned._id === 'string' && !/^[0-9a-fA-F]{24}$/.test(cleaned._id)) {
                    const { _id, ...rest } = cleaned;
                    return rest;
                }
                return cleaned;
            });
        }

        // For payments, strip out client-generated string _ids for new entries
        if (body.payments && Array.isArray(body.payments)) {
            body.payments = body.payments.map((p: any) => {
                // If _id looks like a timestamp string (not a valid ObjectId), remove it so Mongo generates a real one
                if (p._id && typeof p._id === 'string' && !/^[0-9a-fA-F]{24}$/.test(p._id)) {
                    const { _id, ...rest } = p;
                    return rest;
                }
                return p;
            });
        }

        let updatedOrder = await SaleOrder.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true, runValidators: true }
        )
        .populate('clientId', 'name addresses phones emails contacts salesPerson description website facebookPage industry forecastedAmount defaultPaymentMethod defaultShippingTerms contactStatus contactType billing')
        .lean();

        // Manual SKU populate (bypasses Mongoose's String vs ObjectId type mismatch)
        updatedOrder = await manualPopulateSkus(updatedOrder);

        if (!updatedOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (updatedOrder.lineItems && Array.isArray(updatedOrder.lineItems)) {
            updatedOrder.lineItems = await enrichLineItemsWithCost(updatedOrder.lineItems);
        }

        // Sync new payments to AppSheet in background
        if (body.payments && Array.isArray(updatedOrder.payments)) {
            const newPayments = updatedOrder.payments.filter(
                (p: any) => !existingPaymentIds.includes(p._id?.toString())
            );
            if (newPayments.length > 0) {
                after(async () => {
                    try {
                        for (const payment of newPayments) {
                            await syncPaymentToAppSheet(
                                updatedOrder,
                                payment,
                                'Add'
                            );
                        }
                    } catch (err) {
                        console.error('Background AppSheet payment sync failed:', err);
                    }
                });
            }

            // Sync updated (edited) payments to AppSheet in background
            const updatedPayments = updatedOrder.payments.filter((p: any) => {
                const pid = p._id?.toString();
                if (!existingPaymentIds.includes(pid)) return false;
                const oldPayment = existingPayments.find((ep: any) => ep._id?.toString() === pid);
                if (!oldPayment) return false;
                return (
                    oldPayment.paymentAmount !== p.paymentAmount ||
                    oldPayment.createdBy !== p.createdBy ||
                    String(oldPayment.createdAt) !== String(p.createdAt)
                );
            });
            if (updatedPayments.length > 0) {
                after(async () => {
                    try {
                        for (const payment of updatedPayments) {
                            await syncPaymentToAppSheet(
                                updatedOrder,
                                payment,
                                'Edit'
                            );
                        }
                    } catch (err) {
                        console.error('Background AppSheet payment edit sync failed:', err);
                    }
                });
            }

            // Sync deleted payments to AppSheet in background
            const updatedPaymentIds = updatedOrder.payments.map((p: any) => p._id?.toString());
            const deletedPayments = existingPayments.filter(
                (p: any) => !updatedPaymentIds.includes(p._id?.toString())
            );
            if (deletedPayments.length > 0) {
                after(async () => {
                    try {
                        for (const payment of deletedPayments) {
                            await syncPaymentToAppSheet(
                                existingOrderData || { _id: id },
                                payment,
                                'Delete'
                            );
                        }
                    } catch (err) {
                        console.error('Background AppSheet payment delete sync failed:', err);
                    }
                });
            }
        }

        // Sync line items to AppSheet "Order Details" table in background
        if (body.lineItems && Array.isArray(updatedOrder.lineItems)) {
            // New line items
            const newLineItems = updatedOrder.lineItems.filter(
                (li: any) => !existingLineItemIds.includes(li._id?.toString())
            );
            if (newLineItems.length > 0) {
                after(async () => {
                    try {
                        for (const lineItem of newLineItems) {
                            await syncOrderLineItemToAppSheet(
                                updatedOrder,
                                lineItem,
                                'Add'
                            );
                        }
                    } catch (err) {
                        console.error('Background AppSheet line item sync failed:', err);
                    }
                });
            }

            // Edited line items
            const editedLineItems = updatedOrder.lineItems.filter((li: any) => {
                const lid = li._id?.toString();
                if (!existingLineItemIds.includes(lid)) return false;
                const oldItem = existingLineItems.find((eli: any) => eli._id?.toString() === lid);
                if (!oldItem) return false;
                return (
                    oldItem.lotNumber !== li.lotNumber ||
                    oldItem.qtyShipped !== li.qtyShipped ||
                    oldItem.price !== li.price ||
                    oldItem.uom !== li.uom ||
                    String(oldItem.sku) !== String(li.sku)
                );
            });
            if (editedLineItems.length > 0) {
                after(async () => {
                    try {
                        for (const lineItem of editedLineItems) {
                            await syncOrderLineItemToAppSheet(
                                updatedOrder,
                                lineItem,
                                'Edit'
                            );
                        }
                    } catch (err) {
                        console.error('Background AppSheet line item edit sync failed:', err);
                    }
                });
            }

            // Deleted line items
            const updatedLineItemIds = updatedOrder.lineItems.map((li: any) => li._id?.toString());
            const deletedLineItems = existingLineItems.filter(
                (li: any) => !updatedLineItemIds.includes(li._id?.toString())
            );
            if (deletedLineItems.length > 0) {
                after(async () => {
                    try {
                        for (const lineItem of deletedLineItems) {
                            await syncOrderLineItemToAppSheet(
                                existingOrderData || { _id: id },
                                lineItem,
                                'Delete'
                            );
                        }
                    } catch (err) {
                        console.error('Background AppSheet line item delete sync failed:', err);
                    }
                });
            }
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

        // Fetch the order first so we have the data needed for AppSheet deletion
        const order = await SaleOrder.findById(id).lean();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Delete from MongoDB
        await SaleOrder.findByIdAndDelete(id);

        // Delete from AppSheet in background (non-blocking)
        after(async () => {
            try {
                await deleteOrderFromAppSheet(order);
            } catch (err) {
                console.error('Background AppSheet delete failed:', err);
            }
        });

        return NextResponse.json({ message: 'Order deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

