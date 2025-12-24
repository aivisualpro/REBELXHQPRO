import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import PurchaseOrder from '@/models/PurchaseOrder';
import Sku from '@/models/Sku';
import Vendor from '@/models/Vendor';

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

        const order = await PurchaseOrder.findById(id)
            .populate('vendor', 'name')
            .populate('createdBy', 'firstName lastName')
            .populate('lineItems.sku', 'name')
            .populate('lineItems.createdBy', 'firstName lastName')
            .lean();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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
