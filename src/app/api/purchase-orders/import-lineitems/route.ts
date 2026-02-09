import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import PurchaseOrder from '@/models/PurchaseOrder';
import Sku from '@/models/Sku';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Build SKU lookup map (by legacyId and _id) to resolve SKU references
        const allSkus = await Sku.find({}).select('_id legacyId').lean();
        const skuMap = new Map<string, string>();
        allSkus.forEach((s: any) => {
            if (s.legacyId) skuMap.set(s.legacyId.trim().toLowerCase(), s._id.toString());
            if (s._id) skuMap.set(s._id.toString().trim().toLowerCase(), s._id.toString());
        });

        // Helper to parse numbers from CSV strings (up to 8 decimals)
        const parseNum = (val: any): number | undefined => {
            if (val === undefined || val === null || val === '') return undefined;
            const cleaned = String(val).replace(/[^0-9.\-]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? undefined : num;
        };

        let skuResolved = 0;
        let skuUnresolved = 0;

        const operations = data
            .filter((item: any) => item.poNumber) // poNumber acts as reference to Parent PO (legacyId)
            .map((item: any) => {
                const qtyOrdered = parseNum(item.qtyOrdered);
                const cost = parseNum(item.cost);
                const amount = parseNum(item.amount);

                // Resolve SKU legacy ID to actual ObjectId
                let resolvedSku = item.sku;
                if (item.sku) {
                    const skuKey = String(item.sku).trim().toLowerCase();
                    const skuId = skuMap.get(skuKey);
                    if (skuId) {
                        resolvedSku = skuId;
                        skuResolved++;
                    } else {
                        skuUnresolved++;
                        console.warn(`SKU not found for legacyId: "${item.sku}"`);
                    }
                }

                return {
                    updateOne: {
                        filter: { legacyId: item.poNumber },
                        update: {
                            $push: {
                                lineItems: {
                                    _id: item._id || new mongoose.Types.ObjectId().toString(),
                                    sku: resolvedSku,
                                    lotNumber: item.lotNumber,
                                    qtyOrdered: qtyOrdered,
                                    qtyReceived: parseNum(item.qtyReceived),
                                    uom: item.uom,
                                    cost: cost,
                                    amount: amount,
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
            count: result.modifiedCount,
            skuResolved,
            skuUnresolved
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
