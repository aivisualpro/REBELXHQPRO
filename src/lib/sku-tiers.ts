import dbConnect from './mongoose';
import SaleOrder from '@/models/SaleOrder';
import WebOrder from '@/models/WebOrder';
import Manufacturing from '@/models/Manufacturing';
import { getGlobalStartDate } from './global-settings';

export async function getSkuTiers(skuIds: string[]) {
    if (!skuIds.length) return {};
    
    await dbConnect();
    
    // Get global date filter
    const startDate = await getGlobalStartDate();
    const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};
    
    const [sosAll, wosAll, mosConsAll] = await Promise.all([
        SaleOrder.find({ 'lineItems.sku': { $in: skuIds }, ...dateFilter }).select('lineItems.sku lineItems.qtyShipped').lean(),
        WebOrder.find({
            "lineItems.sku": { $in: skuIds },
            ...dateFilter
        }).select('status lineItems.sku lineItems.qty').lean(),
        Manufacturing.find({ 'lineItems.sku': { $in: skuIds }, ...dateFilter }).select('qty lineItems.sku lineItems.recipeQty lineItems.sa lineItems.qtyScrapped').lean()
    ]);

    const tiers: Record<string, number> = {};

    skuIds.forEach(id => {
        const sid = id.toString();
        // hasSales: Only count orders where items were actually shipped/sold
        const hasSales = sosAll.some(so => (so as any).lineItems.some((li: any) => 
            (li.sku?._id || li.sku)?.toString() === sid && (li.qtyShipped > 0)
        )) || wosAll.some(wo => (wo as any).lineItems.some((li: any) => 
            (li.sku?._id || li.sku)?.toString() === sid && 
            (li.qty > 0) && 
            ((wo as any).status === 'Shipped' || (wo as any).status === 'Delivered' || (wo as any).status === 'Completed')
        ));
        const hasConsumption = mosConsAll.some(mo => (mo as any).lineItems.some((li: any) => {
            if ((li.sku?._id || li.sku)?.toString() !== sid) return false;
            
            // Virtual field calculations
            const orderQty = (mo as any).qty || 0;
            const recipeQty = li.recipeQty || 0;
            const saPercent = li.sa || 0; // SA is stored as percentage (e.g., 55.6 for 55.6%)
            const sa = saPercent / 100; // Convert to decimal (e.g., 0.556)
            const qtyScrapped = li.qtyScrapped || 0;
            
            // bomQty = [qty] * [recipeQty]
            const bomQty = orderQty * recipeQty;
            
            // qtyExtra only calculated if sa > 0
            const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
            
            // Simple formula: totalQty = bomQty + qtyScrapped + qtyExtra
            const totalQty = bomQty + qtyScrapped + qtyExtra;
            
            return totalQty > 0;
        }));

        let tier = 0;
        if (hasSales && !hasConsumption) tier = 1;
        else if (hasSales && hasConsumption) tier = 2;
        else if (!hasSales && hasConsumption) tier = 3;
        
        // Default to Tier 3 if it's an ingredient but no usage yet?
        // User logic is explicit: Tier 3 is ONLY consumption.
        // If no usage at all, maybe tier 0 (uncategorized).
        
        tiers[sid] = tier;
    });

    return tiers;
}
