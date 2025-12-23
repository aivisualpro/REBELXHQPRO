import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import PurchaseOrder from '@/models/PurchaseOrder';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Helper to parse numbers from CSV strings (up to 8 decimals)
        const parseNum = (val: any): number | undefined => {
            if (val === undefined || val === null || val === '') return undefined;
            const cleaned = String(val).replace(/[^0-9.\-]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? undefined : num;
        };

        const operations = data
            .filter((item: any) => item.poNumber) // poNumber acts as reference to Parent PO
            .map((item: any) => {
                const qtyOrdered = parseNum(item.qtyOrdered);
                const cost = parseNum(item.cost);

                return {
                    updateOne: {
                        filter: { _id: item.poNumber },
                        update: {
                            $push: {
                                lineItems: {
                                    _id: item._id || new mongoose.Types.ObjectId().toString(),
                                    sku: item.sku,
                                    lotNumber: item.lotNumber,
                                    qtyOrdered: qtyOrdered,
                                    qtyReceived: parseNum(item.qtyReceived),
                                    uom: item.uom,
                                    cost: cost,
                                    createdAt: item.createAt ? new Date(item.createAt) : new Date(),
                                    createdBy: item.createBy || item.createdBy
                                }
                            }
                        }
                    }
                };
            });

        if (operations.length === 0) {
            return NextResponse.json({ message: 'No valid line items to import', count: 0 });
        }

        const result = await PurchaseOrder.bulkWrite(operations as any);

        return NextResponse.json({
            message: 'Line items import completed',
            count: result.modifiedCount
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
