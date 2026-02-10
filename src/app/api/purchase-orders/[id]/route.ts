import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import PurchaseOrder from '@/models/PurchaseOrder';
import Sku from '@/models/Sku';
import Vendor from '@/models/Vendor';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        void Sku; // Ensure Sku model is registered
        void Vendor; // Ensure Vendor model is registered

        const { id } = await context.params;
        const db = mongoose.connection.db!;

        // Step 1: Get raw PO from native driver to preserve original sku strings
        // (Mongoose populate silently nullifies sku due to String/ObjectId type mismatch)
        // Try ObjectId first (new docs), then string fallback (legacy docs)
        let rawOrder: any = null;
        try {
            rawOrder = await db.collection('purchaseorders').findOne({ _id: new mongoose.Types.ObjectId(id) as any });
        } catch {
            // Invalid ObjectId format, skip
        }
        if (!rawOrder) {
            rawOrder = await db.collection('purchaseorders').findOne({ _id: id as any });
        }
        if (!rawOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Step 2: Get the Mongoose-populated version (for vendor, createdBy, lineItems.createdBy)
        const order = await PurchaseOrder.findById(id)
            .populate('vendor', 'name')
            .populate('createdBy', 'firstName lastName')
            .populate('lineItems.createdBy', 'firstName lastName')
            .lean();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Step 3: Manually resolve SKUs using raw sku values from the native query
        if (rawOrder.lineItems?.length) {
            // Collect all raw sku references
            const rawSkuRefs = rawOrder.lineItems
                .map((item: any) => item.sku)
                .filter((s: any) => s != null);

            if (rawSkuRefs.length > 0) {
                // Build ObjectId versions for refs that look like ObjectIds
                const objectIds = rawSkuRefs
                    .filter((ref: any) => typeof ref === 'string' && mongoose.Types.ObjectId.isValid(ref))
                    .map((ref: string) => new mongoose.Types.ObjectId(ref));

                const stringRefs = rawSkuRefs.map((ref: any) => ref.toString());

                // Query skus by _id (both String and ObjectId types) AND legacyId
                const skuDocs = await db.collection('skus').find({
                    $or: [
                        { _id: { $in: stringRefs } },
                        ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
                        { legacyId: { $in: stringRefs } }
                    ]
                }, { projection: { _id: 1, name: 1, legacyId: 1 } }).toArray();

                // Build lookup map keyed by _id (string) AND legacyId
                const skuMap = new Map<string, { _id: string; name: string }>();
                skuDocs.forEach((s: any) => {
                    const entry = { _id: s._id.toString(), name: s.name };
                    skuMap.set(s._id.toString(), entry);
                    if (s.legacyId) skuMap.set(s.legacyId, entry);
                });

                // Merge raw sku refs into the populated order
                order.lineItems = (order.lineItems || []).map((item: any, idx: number) => {
                    const rawSku = rawOrder.lineItems[idx]?.sku;
                    if (rawSku) {
                        const rawSkuStr = rawSku.toString();
                        const match = skuMap.get(rawSkuStr);
                        if (match) {
                            return { ...item, sku: { _id: match._id, name: match.name } };
                        }
                        // Keep as string if no match found
                        return { ...item, sku: rawSkuStr };
                    }
                    return item;
                });
            }
        }

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

        // Check if we need to generate lot numbers
        // We need existing order state to know current status if not provided
        const existing = await PurchaseOrder.findById(id).lean();
        if (!existing) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const finalStatus = body.status || existing.status;

        if (finalStatus === 'Received') {
            let lineItemsToUpdate = body.lineItems || existing.lineItems || [];

            // Determine date
            let dateObj;
            if (body.receivedDate) dateObj = new Date(body.receivedDate);
            else if (existing.receivedDate) dateObj = new Date(existing.receivedDate);
            else {
                dateObj = new Date();
                // If we are setting status to Received now, set date
                if (!existing.receivedDate) {
                    body.receivedDate = dateObj;
                }
            }

            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const yyyy = dateObj.getFullYear();
            const dateStr = `${mm}/${dd}/${yyyy}`;

            lineItemsToUpdate = lineItemsToUpdate.map((item: any, index: number) => {
                // If already has lot number, keep it
                if (item.lotNumber) return item;

                return {
                    ...item,
                    lotNumber: `${dateStr}-.${index + 1}`
                };
            });

            body.lineItems = lineItemsToUpdate;
        }

        const updated = await PurchaseOrder.findByIdAndUpdate(id, body, { new: true });

        // Propagate cost changes
        if (updated && updated.lineItems) {
            const { propagateCostChange } = await import('@/lib/cost-propagation');
            for (const item of updated.lineItems) {
                if (item.sku && item.lotNumber) {
                    // Use cost or price as cost basis
                    const c = item.cost !== undefined ? item.cost : (item.price || 0);
                    const skuId = (item.sku && typeof item.sku === 'object' && '_id' in item.sku) ? item.sku._id : item.sku;
                    await propagateCostChange(skuId, item.lotNumber, c);
                }
            }
        }

        return NextResponse.json(updated);
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

        const deleted = await PurchaseOrder.findByIdAndDelete(id);
        if (!deleted) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Order deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
