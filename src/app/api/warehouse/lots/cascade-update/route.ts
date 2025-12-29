import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import OpeningBalance from '@/models/OpeningBalance';
import AuditAdjustment from '@/models/AuditAdjustment';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import WebOrder from '@/models/WebOrder';

export const dynamic = 'force-dynamic';

/**
 * Cascade Update Lot Number
 * 
 * When a lot number is changed at its source (Manufacturing, Opening Balance, Audit Adjustment, PO),
 * this endpoint updates all documents that reference the old lot number.
 * 
 * POST /api/warehouse/lots/cascade-update
 * Body: {
 *   skuId: string,
 *   oldLotNumber: string,
 *   newLotNumber: string,
 *   sourceType: 'Manufacturing' | 'OpeningBalance' | 'AuditAdjustment' | 'PurchaseOrder',
 *   sourceId: string
 * }
 */
export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        
        const body = await request.json();
        const { skuId, oldLotNumber, newLotNumber, sourceType, sourceId } = body;
        
        if (!skuId || !oldLotNumber || !newLotNumber) {
            return NextResponse.json(
                { error: 'skuId, oldLotNumber, and newLotNumber are required' },
                { status: 400 }
            );
        }
        
        if (oldLotNumber === newLotNumber) {
            return NextResponse.json({ 
                message: 'Lot numbers are the same, no update needed',
                updates: {}
            });
        }
        
        const updates: Record<string, number> = {
            manufacturing: 0,
            manufacturingIngredients: 0,
            saleOrders: 0,
            webOrders: 0,
            auditAdjustments: 0
        };
        
        // 1. Update the source document first (if sourceType and sourceId are provided)
        if (sourceType && sourceId) {
            switch (sourceType) {
                case 'Manufacturing':
                    // Update the manufacturing job's lotNumber
                    const mfgResult = await Manufacturing.updateOne(
                        { _id: sourceId },
                        { $set: { lotNumber: newLotNumber } }
                    );
                    if (mfgResult.modifiedCount > 0) updates.manufacturing++;
                    break;
                    
                case 'OpeningBalance':
                    await OpeningBalance.updateOne(
                        { _id: sourceId },
                        { $set: { lotNumber: newLotNumber } }
                    );
                    break;
                    
                case 'AuditAdjustment':
                    await AuditAdjustment.updateOne(
                        { _id: sourceId },
                        { $set: { lotNumber: newLotNumber } }
                    );
                    break;
                    
                case 'PurchaseOrder':
                    // Update the specific line item's lotNumber
                    await PurchaseOrder.updateOne(
                        { _id: sourceId, 'lineItems.lotNumber': oldLotNumber },
                        { $set: { 'lineItems.$.lotNumber': newLotNumber } }
                    );
                    break;
            }
        }
        
        // 2. Update all Manufacturing jobs where this SKU's lot was used as an ingredient
        const mfgIngredientResult = await Manufacturing.updateMany(
            { 
                'lineItems.sku': skuId,
                'lineItems.lotNumber': oldLotNumber
            },
            { 
                $set: { 'lineItems.$[elem].lotNumber': newLotNumber }
            },
            {
                arrayFilters: [{ 'elem.sku': skuId, 'elem.lotNumber': oldLotNumber }]
            }
        );
        updates.manufacturingIngredients = mfgIngredientResult.modifiedCount;
        
        // 3. Update all Sale Orders where this lot was used
        const saleOrderResult = await SaleOrder.updateMany(
            {
                'lineItems.sku': skuId,
                'lineItems.lotNumber': oldLotNumber
            },
            {
                $set: { 'lineItems.$[elem].lotNumber': newLotNumber }
            },
            {
                arrayFilters: [{ 'elem.sku': skuId, 'elem.lotNumber': oldLotNumber }]
            }
        );
        updates.saleOrders = saleOrderResult.modifiedCount;
        
        // 4. Update all Web Orders where this lot was used
        // Web orders can have either sku or linkedSkuId
        const webOrderResult = await WebOrder.updateMany(
            {
                $or: [
                    { 'lineItems.sku': skuId, 'lineItems.lotNumber': oldLotNumber },
                    { 'lineItems.linkedSkuId': skuId, 'lineItems.lotNumber': oldLotNumber }
                ]
            },
            {
                $set: { 'lineItems.$[elem].lotNumber': newLotNumber }
            },
            {
                arrayFilters: [
                    { 
                        $or: [
                            { 'elem.sku': skuId },
                            { 'elem.linkedSkuId': skuId }
                        ],
                        'elem.lotNumber': oldLotNumber 
                    }
                ]
            }
        );
        updates.webOrders = webOrderResult.modifiedCount;
        
        // 5. Update other Audit Adjustments with the same SKU and lot (if not the source)
        if (sourceType !== 'AuditAdjustment') {
            const auditResult = await AuditAdjustment.updateMany(
                { sku: skuId, lotNumber: oldLotNumber },
                { $set: { lotNumber: newLotNumber } }
            );
            updates.auditAdjustments = auditResult.modifiedCount;
        }
        
        const totalUpdates = Object.values(updates).reduce((sum, count) => sum + count, 0);
        
        return NextResponse.json({
            success: true,
            message: `Lot number updated from "${oldLotNumber}" to "${newLotNumber}"`,
            totalDocumentsUpdated: totalUpdates,
            updates
        });
        
    } catch (error: any) {
        console.error('Error cascading lot number update:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to cascade lot number update' },
            { status: 500 }
        );
    }
}

/**
 * Preview what documents would be affected by a lot number change
 * 
 * GET /api/warehouse/lots/cascade-update?skuId=xxx&oldLotNumber=yyy
 */
export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        
        const { searchParams } = new URL(request.url);
        const skuId = searchParams.get('skuId');
        const oldLotNumber = searchParams.get('oldLotNumber');
        
        if (!skuId || !oldLotNumber) {
            return NextResponse.json(
                { error: 'skuId and oldLotNumber are required' },
                { status: 400 }
            );
        }
        
        // Count affected documents
        const [
            manufacturingCount,
            manufacturingIngredientCount,
            saleOrderCount,
            webOrderCount,
            auditCount
        ] = await Promise.all([
            Manufacturing.countDocuments({ sku: skuId, lotNumber: oldLotNumber }),
            Manufacturing.countDocuments({ 
                'lineItems.sku': skuId, 
                'lineItems.lotNumber': oldLotNumber 
            }),
            SaleOrder.countDocuments({ 
                'lineItems.sku': skuId, 
                'lineItems.lotNumber': oldLotNumber 
            }),
            WebOrder.countDocuments({ 
                $or: [
                    { 'lineItems.sku': skuId, 'lineItems.lotNumber': oldLotNumber },
                    { 'lineItems.linkedSkuId': skuId, 'lineItems.lotNumber': oldLotNumber }
                ]
            }),
            AuditAdjustment.countDocuments({ sku: skuId, lotNumber: oldLotNumber })
        ]);
        
        return NextResponse.json({
            skuId,
            lotNumber: oldLotNumber,
            affectedDocuments: {
                manufacturing: manufacturingCount,
                manufacturingIngredients: manufacturingIngredientCount,
                saleOrders: saleOrderCount,
                webOrders: webOrderCount,
                auditAdjustments: auditCount
            },
            totalAffected: manufacturingCount + manufacturingIngredientCount + saleOrderCount + webOrderCount + auditCount
        });
        
    } catch (error: any) {
        console.error('Error previewing cascade:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to preview cascade' },
            { status: 500 }
        );
    }
}
