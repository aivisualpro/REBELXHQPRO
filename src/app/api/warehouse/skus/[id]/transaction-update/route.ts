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
                // Web Orders might be tricky if lineItems don't have _ids preserved or matched perfectly
                // Try matching by _id first
                result = await WebOrder.findOneAndUpdate(
                    { _id: docId, "lineItems._id": lineItemId },
                    { $set: { "lineItems.$.lotNumber": newLotNumber } },
                    { new: true }
                );
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
