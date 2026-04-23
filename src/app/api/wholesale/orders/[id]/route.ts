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
import OrderEmail from '@/models/OrderEmail';
import { deleteOrderFromAppSheet, syncPaymentToAppSheet, syncOrderLineItemToAppSheet } from '@/lib/appsheet';
import { processEmailInBackground } from '@/app/api/sales/orders/[id]/emails/route';

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

        const needsSnapshot = (body.payments && Array.isArray(body.payments)) || (body.lineItems && Array.isArray(body.lineItems)) || ('orderStatus' in body);
        if (needsSnapshot) {
            const existingOrder = await SaleOrder.findById(id).select('payments lineItems label legacyId orderStatus').lean() as any;
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
        .populate('salesRep', 'firstName lastName email')
        .lean() as any;

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

        // ─── Auto-email on Completed status ───
        const clientEmails = updatedOrder.clientId?.emails?.map((e: any) => e.value).filter(Boolean) || [];
        const contactEmails = updatedOrder.clientId?.contacts?.map((c: any) => c.email).filter(Boolean) || [];
        const allClientEmails = Array.from(new Set([...clientEmails, ...contactEmails]));

        if (
            body.orderStatus === 'Completed' && 
            existingOrderData && 
            existingOrderData.orderStatus !== 'Completed'
        ) {
            const salesRepEmail = updatedOrder.salesRep?.email;
            const clientName = updatedOrder.clientId?.name || 'Valued Customer';
            const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@rebelxbrandscrm.com';
            
            // 1. Client Email
            if (allClientEmails.length > 0) {
                const trackingSection = updatedOrder.trackingNumber 
                    ? `
        <div style="background-color: #f1f5f9; border-radius: 6px; padding: 20px; margin: 0 0 24px 0; text-align: center; border: 1px dashed #cbd5e1;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Tracking Information</p>
            <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: bold; color: #0f172a;">${updatedOrder.trackingNumber}</p>
            <a href="https://www.google.com/search?q=${encodeURIComponent(updatedOrder.trackingNumber)}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 4px; font-size: 13px; font-weight: bold;">Track Package</a>
        </div>`
                    : '';

                const trackingText = updatedOrder.trackingNumber 
                    ? `Tracking Number: ${updatedOrder.trackingNumber}\nTrack here: https://www.google.com/search?q=${encodeURIComponent(updatedOrder.trackingNumber)}\n\n` 
                    : '';

                const clientHtml = `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
    <div style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase;">Order Completed</h1>
        <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">RebelX Brands</p>
    </div>
    <div style="padding: 40px 32px;">
        <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #1e293b;">Dear ${clientName},</h2>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #475569; line-height: 1.6;">Great news! Your wholesale order <strong style="color: #0f172a;">${updatedOrder.label}</strong> has been fully processed and marked as <span style="background-color: #10b981; color: #ffffff; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Completed</span>.</p>
        <p style="margin: 0 0 24px 0; font-size: 16px; color: #475569; line-height: 1.6;">Our team has finalized everything, and your products are ready. We have attached a comprehensive PDF snapshot of your order details for your records.</p>
        ${trackingSection}
        <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 0 32px 0; border-radius: 0 4px 4px 0;">
            <p style="margin: 0; font-size: 14px; color: #334155; font-weight: 500;"><strong>Next Steps:</strong> Please review the attached document. If you have any questions regarding your shipment or pick-up, reply directly to this email or contact your sales representative.</p>
        </div>
        
        <p style="margin: 0 0 8px 0; font-size: 16px; color: #1e293b; font-weight: bold;">Thank you for your business!</p>
        <p style="margin: 0; font-size: 14px; color: #64748b;">— The RebelX Brands Team</p>
    </div>
    <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} RebelX Brands. All rights reserved.</p>
    </div>
</div>`;

                const clientText = `Dear ${clientName},\n\nGreat news! Your wholesale order ${updatedOrder.label} has been fully processed and marked as Completed.\n\nOur team has finalized everything, and your products are ready. We have attached a comprehensive PDF snapshot of your order details for your records.\n\n${trackingText}Next Steps: Please review the attached document. If you have any questions regarding your shipment or pick-up, reply directly to this email.\n\nThank you for your business!\n— The RebelX Brands Team`;

                const clientEmailRecord = await OrderEmail.create({
                    orderId: id,
                    from: fromEmail,
                    to: allClientEmails,
                    cc: [],
                    bcc: [],
                    subject: `Order ${updatedOrder.label || 'Details'} Completed`,
                    body: clientHtml,
                    bodyText: clientText,
                    hasAttachment: true,
                    attachmentName: `${updatedOrder.label || 'SaleOrder'}.pdf`,
                    status: 'queued',
                    sentBy: 'system',
                });

                after(async () => {
                    try {
                        await processEmailInBackground(clientEmailRecord._id.toString(), id, {
                            to: allClientEmails,
                            cc: [],
                            subject: `Order ${updatedOrder.label || 'Details'} Completed`,
                            htmlBody: clientHtml,
                            textBody: clientText,
                            attachPdf: true,
                            orderLabel: updatedOrder.label,
                        });
                    } catch (err) {
                        console.error('Background auto-email to client error:', err);
                    }
                });
            }

            // 2. Sales Rep Email
            if (salesRepEmail) {
                const repHtml = `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
    <div style="background-color: #1e293b; padding: 24px; text-align: center; border-bottom: 4px solid #f59e0b;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 1px; text-transform: uppercase;">Internal Notification</h1>
        <p style="color: #f59e0b; margin: 4px 0 0 0; font-size: 12px; font-weight: bold; letter-spacing: 2px;">ORDER COMPLETED</p>
    </div>
    <div style="padding: 32px;">
        <h2 style="margin: 0 0 24px 0; font-size: 18px; color: #1e293b;">Hello${updatedOrder.salesRep?.firstName ? ' ' + updatedOrder.salesRep.firstName : ''},</h2>
        <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569; line-height: 1.6;">Excellent work! Wholesale order <strong style="color: #0f172a; border-bottom: 1px dashed #94a3b8;">${updatedOrder.label}</strong> for your client <strong style="color: #0f172a;">${clientName}</strong> has just been marked as completed by the fulfillment team.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0; background-color: #f8fafc; border-radius: 6px; overflow: hidden;">
            <tr>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: bold; width: 40%;">CLIENT</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; font-weight: bold;">${clientName}</td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: bold;">ORDER REF</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a;">${updatedOrder.label}</td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; font-size: 13px; color: #64748b; font-weight: bold;">STATUS</td>
                <td style="padding: 12px 16px; font-size: 14px;"><span style="color: #10b981; font-weight: bold;">● Completed</span></td>
            </tr>
        </table>
        
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">The client has been automatically notified. We have attached a copy of the final PDF snapshot for your personal records.</p>
        
        <div style="text-align: center; margin-top: 32px;">
            <a href="https://www.rebelxbrandscrm.com/sales/wholesale-orders/${id}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">VIEW ORDER IN CRM</a>
        </div>
    </div>
</div>`;

                const repText = `Hello${updatedOrder.salesRep?.firstName ? ' ' + updatedOrder.salesRep.firstName : ''},\n\nExcellent work! Wholesale order ${updatedOrder.label} for your client ${clientName} has just been marked as completed by the fulfillment team.\n\nThe client has been automatically notified. We have attached a copy of the final PDF snapshot for your personal records.\n\nView Order: https://www.rebelxbrandscrm.com/sales/wholesale-orders/${id}`;

                const repEmailRecord = await OrderEmail.create({
                    orderId: id,
                    from: fromEmail,
                    to: [salesRepEmail],
                    cc: [],
                    bcc: [],
                    subject: `Order ${updatedOrder.label || 'Details'} Completed - Internal Copy`,
                    body: repHtml,
                    bodyText: repText,
                    hasAttachment: true,
                    attachmentName: `${updatedOrder.label || 'SaleOrder'}.pdf`,
                    status: 'queued',
                    sentBy: 'system',
                });

                after(async () => {
                    try {
                        await processEmailInBackground(repEmailRecord._id.toString(), id, {
                            to: [salesRepEmail],
                            cc: [],
                            subject: `Order ${updatedOrder.label || 'Details'} Completed - Internal Copy`,
                            htmlBody: repHtml,
                            textBody: repText,
                            attachPdf: true,
                            orderLabel: updatedOrder.label,
                        });
                    } catch (err) {
                        console.error('Background auto-email to sales rep error:', err);
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

