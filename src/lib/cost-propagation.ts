import mongoose from 'mongoose';
import SaleOrder from '@/models/SaleOrder';
import dbConnect from '@/lib/mongoose';

/**
 * Propagates cost changes from a source (Opening Balance, Purchase Order)
 * to all downstream documents that snapshot the cost (e.g., Sale Orders).
 */
export async function propagateCostChange(skuId: string | any, lotNumber: string, newCost: number) {
    if (!skuId || !lotNumber) return;

    await dbConnect();
    
    const cost = Number(newCost) || 0;

    // Handle skuId: It might be a populated object, an ObjectId, or a String.
    // Since SaleOrder schema defines sku as String (for custom IDs), we ensure we use the string representation.
    let skuRef = skuId;
    if (typeof skuId === 'object' && skuId !== null) {
        if (skuId._id) skuRef = skuId._id; // Handle populated object
        else skuRef = skuId.toString(); // Handle ObjectId
    }
    
    // Ensure it's a string
    const finalSku = String(skuRef);

    try {
        // Update Wholesale Orders
        // We use arrayFilters to target the specific line item
        // Note: SaleOrder schema uses type: String for sku, so we match against the string ID.
        const result = await SaleOrder.updateMany(
            { 
                "lineItems.sku": finalSku, 
                "lineItems.lotNumber": lotNumber 
            },
            { 
                $set: { "lineItems.$[elem].cost": cost } 
            },
            { 
                arrayFilters: [
                    { "elem.sku": finalSku, "elem.lotNumber": lotNumber }
                ] 
            }
        );
        
        console.log(`[CostPropagation] Updated ${result.modifiedCount} Sale Orders for SKU ${finalSku} Lot ${lotNumber} -> $${cost} (matched against string ID)`);

    } catch (error) {
        console.error("[CostPropagation] Error propagating cost:", error);
        // Do not throw, so we don't block the source update
    }
}
