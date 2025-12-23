import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';

import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import User from '@/models/User';
import { Recipe } from '@/models/Recipe';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        void Sku; // Ensure Sku model is registered
        void User; // Ensure User model is registered
        void Recipe; // Ensure Recipe model is registered

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

        // Enrich line items with cost based on Lot Number (Same logic as Sales Orders)
        if (order.lineItems && Array.isArray(order.lineItems)) {
            const enrichedLineItems = await Promise.all(order.lineItems.map(async (item: any) => {
                let cost = 0;
                const skuId = item.sku?._id || item.sku;
                const lotNumber = item.lotNumber; // Assuming Manufacturing lineItems have lotNumber

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
                                cost = line.cost || 0;
                            }
                        }
                    }
                }
                return { ...item, cost };
            }));
            order.lineItems = enrichedLineItems as any;
        }

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

        // Enrich line items with cost based on Lot Number (Same logic as GET)
        if (order.lineItems && Array.isArray(order.lineItems)) {
            const enrichedLineItems = await Promise.all(order.lineItems.map(async (item: any) => {
                let cost = 0;
                const skuId = item.sku?._id || item.sku;
                const lotNumber = item.lotNumber;

                if (skuId && lotNumber) {
                    const ob = await OpeningBalance.findOne({
                        sku: skuId,
                        lotNumber: lotNumber
                    }).select('cost').lean();

                    if (ob) {
                        cost = ob.cost || 0;
                    } else {
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
                                cost = line.cost || 0;
                            }
                        }
                    }
                }
                return { ...item, cost };
            }));
            order.lineItems = enrichedLineItems as any;
        }

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

        const deleted = await Manufacturing.findByIdAndDelete(id);
        if (!deleted) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Order deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
