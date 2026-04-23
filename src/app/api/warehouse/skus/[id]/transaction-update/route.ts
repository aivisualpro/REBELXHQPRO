import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';

export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        
        // Ensure models are registered (though import should handle it)
        void OpeningBalance;
        void PurchaseOrder;
        void SaleOrder;
        void Manufacturing;
        void AuditAdjustment;
        void WebOrder;

        const body = await request.json();
        const { type, docId, lineItemId, newLotNumber } = body;

        console.log(`Updating lot for ${type} ${docId} to ${newLotNumber} (Line: ${lineItemId})`);

        if (!docId || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let result;

        switch (type) {
            case 'Opening':
                result = await OpeningBalance.findByIdAndUpdate(
                    docId, 
                    { lotNumber: newLotNumber },
                    { new: true }
                );
                break;

            case 'Purchase Order':
                result = await PurchaseOrder.findOneAndUpdate(
                    { _id: docId, "lineItems._id": lineItemId },
                    { $set: { "lineItems.$.lotNumber": newLotNumber } },
                    { new: true }
                );
                break;

            case 'Orders': // Sale Orders
                result = await SaleOrder.findOneAndUpdate(
                    { _id: docId, "lineItems._id": lineItemId },
                    { $set: { "lineItems.$.lotNumber": newLotNumber } },
                    { new: true }
                );
                break;

            case 'Web Order':
                const resolvedParams = await props.params;
                const skuIdToUpdate = body.skuId || resolvedParams?.id;
                let realLineId: string | number = lineItemId;
                if (typeof lineItemId === 'string' && lineItemId.includes('_')) {
                    const parts = lineItemId.split('_');
                    if (parts.length >= 2) {
                        realLineId = parts[1]; 
                    }
                }
                
                const isNumericId = !isNaN(Number(realLineId)) && realLineId !== '';
                const matchQuery = isNumericId 
                    ? { _id: docId, "lineItems.id": Number(realLineId) }
                    : { _id: docId, "lineItems._id": realLineId };

                const wo = await WebOrder.findOne(matchQuery);
                if (wo) {
                    const line = isNumericId 
                        ? wo.lineItems.find((l: any) => l.id === Number(realLineId))
                        : wo.lineItems.find((l: any) => l._id?.toString() === realLineId);
                        
                    if (line) {
                        // Always update BOTH the main lotNumber and the linkedSkus array.
                        // This guarantees the ledger will pick it up regardless of whether it's a bundle or direct match.
                        const linkedSkuIndex = line.linkedSkus?.findIndex((ls: any) => ls.skuId === skuIdToUpdate);
                        if (linkedSkuIndex !== undefined && linkedSkuIndex >= 0) {
                            const updateKey = `lineItems.$.linkedSkus.${linkedSkuIndex}.lotNumber`;
                            result = await WebOrder.findOneAndUpdate(
                                matchQuery,
                                { $set: { [updateKey]: newLotNumber, "lineItems.$.lotNumber": newLotNumber } },
                                { new: true }
                            );
                        } else {
                            result = await WebOrder.findOneAndUpdate(
                                matchQuery,
                                { 
                                    $push: { "lineItems.$.linkedSkus": { skuId: skuIdToUpdate, lotNumber: newLotNumber, multiplier: 1, cost: 0 } },
                                    $set: { "lineItems.$.lotNumber": newLotNumber }
                                },
                                { new: true }
                            );
                        }
                    }
                }
                break;

            case 'Audit': // Audit Adjustment
                result = await AuditAdjustment.findByIdAndUpdate(
                    docId,
                    { lotNumber: newLotNumber },
                    { new: true }
                );
                break;

            case 'Produced': // Manufacturing Job (Main Output)
                // 'Produced' usually refers to the main job output lot
                result = await Manufacturing.findByIdAndUpdate(
                    docId,
                    { lotNumber: newLotNumber }, // Also update label if it's considered the lot? usually lotNumber field
                    { new: true }
                );
                break;

            case 'Consumption': // Manufacturing Ingredient
                result = await Manufacturing.findOneAndUpdate(
                    { _id: docId, "lineItems._id": lineItemId },
                    { $set: { "lineItems.$.lotNumber": newLotNumber } },
                    { new: true }
                );
                break;

            default:
                return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
        }

        if (!result) {
            return NextResponse.json({ error: 'Document or line item not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Lot updated successfully' });

    } catch (error: any) {
        console.error("Error updating transaction lot:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
