import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Sku from '@/models/Sku';
import Link from 'next/link'; /* unused but keeps imports clean if needed later */
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder'; // Check if this path is correct, previously used
import Client from '@/models/Client';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        // Ensure models are registered
        void Sku;
        void Client;

        const { id } = await Promise.resolve(params); // Await params in Next.js 15+

        const order = await SaleOrder.findById(id)
            .populate('clientId', 'name')
            .populate('lineItems.sku', 'name')
            .lean();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Enrich line items with cost based on Lot Number
        if (order.lineItems && Array.isArray(order.lineItems)) {
            const enrichedLineItems = await Promise.all(order.lineItems.map(async (item: any) => {
                let cost = 0;
                const skuId = item.sku?._id || item.sku; // handle populated or unpopulated
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
                        // Find PO that contains this SKU and Lot
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
            order.lineItems = enrichedLineItems;
        }

        return NextResponse.json(order);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        const { id } = await Promise.resolve(params);
        const body = await request.json();

        // If line items are being updated, ensure totals are correct
        if (body.lineItems && Array.isArray(body.lineItems)) {
            body.lineItems = body.lineItems.map((item: any) => ({
                ...item,
                total: (item.qtyShipped || 0) * (item.price || 0)
            }));
        }

        const updatedOrder = await SaleOrder.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true, runValidators: true }
        )
        .populate('clientId', 'name')
        .populate('lineItems.sku', 'name');

        if (!updatedOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json(updatedOrder);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        const { id } = await Promise.resolve(params);

        const deletedOrder = await SaleOrder.findByIdAndDelete(id);

        if (!deletedOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Order deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
