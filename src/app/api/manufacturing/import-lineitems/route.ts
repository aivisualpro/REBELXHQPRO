import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Helper to parse numbers from CSV strings
        const parseNum = (val: any): number | undefined => {
            if (val === undefined || val === null || val === '') return undefined;
            // Remove percentage signs and other non-numeric chars except . and -
            const cleaned = String(val).replace(/[^0-9.\-]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? undefined : num;
        };

        const operations = data
            .filter((item: any) => item.woNumber) // woNumber acts as reference to Parent Manufacturing Order
            .map((item: any) => ({
                updateOne: {
                    filter: { _id: item.woNumber },
                    update: {
                        $push: {
                            lineItems: {
                                _id: item._id || new mongoose.Types.ObjectId().toString(),
                                lotNumber: item.lotNumber,
                                label: item.label || undefined,
                                recipeId: item.recipeId,
                                sku: item.sku,
                                uom: item.uom,
                                recipeQty: parseNum(item.recipeQty),
                                sa: parseNum(item.sa),
                                qtyExtra: parseNum(item.qtyExtra),
                                qtyScrapped: parseNum(item.qtyScrapped),
                                createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
                            }
                        }
                    }
                }
            }));


        if (operations.length === 0) {
            return NextResponse.json({ message: 'No valid line items to import', count: 0 });
        }

        const result = await Manufacturing.bulkWrite(operations as any);

        return NextResponse.json({
            message: 'Line items import completed',
            count: result.modifiedCount
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
