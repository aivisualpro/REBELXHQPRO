import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();
        const { skip = 0, limit = 500 } = body;

        // 1. Fetch Batch of Orders
        const orders = await SaleOrder.find({})
            .select('lineItems')
            .skip(skip)
            .limit(limit)
            .lean();

        if (orders.length === 0) {
            return NextResponse.json({ processed: 0, ops: 0, stats: { message: 'No orders in this batch' } });
        }

        // 2. Identify Unique (SKU, Lot) pairs needed
        const needed = new Map<string, { sku: string; lot: string }>();
        orders.forEach((o: any) => {
            o.lineItems?.forEach((item: any) => {
                const sku = (item.sku?._id || item.sku)?.toString().trim();
                const lot = item.lotNumber?.toString().trim();
                
                if (sku && lot) {
                    const key = `${sku}:${lot}`;
                    if (!needed.has(key)) {
                        needed.set(key, { sku, lot });
                    }
                }
            });
        });

        if (needed.size === 0) {
            return NextResponse.json({ 
                processed: orders.length, 
                ops: 0, 
                stats: { lineItems: 0, uniquePairs: 0, message: 'No line items with SKU+Lot' }
            });
        }

        // 3. Extract unique SKUs for bulk queries
        const uniqueSkus = Array.from(new Set(Array.from(needed.values()).map(p => p.sku)));
        const validOids = uniqueSkus.filter(s => mongoose.Types.ObjectId.isValid(s)).map(s => new mongoose.Types.ObjectId(s));
        const searchSkus = [...uniqueSkus, ...validOids];

        // 4. Bulk fetch all cost sources in parallel
        const [obs, pos, mfgs, adjs] = await Promise.all([
            OpeningBalance.find({ sku: { $in: searchSkus } } as any).select('sku lotNumber cost').lean(),
            PurchaseOrder.find({ "lineItems.sku": { $in: searchSkus } } as any).select('lineItems').lean(),
            Manufacturing.find({ sku: { $in: searchSkus } } as any).select('sku lotNumber label totalCost qty lineItems labor').lean(),
            AuditAdjustment.find({ sku: { $in: searchSkus } } as any).select('sku lotNumber cost').lean()
        ]);

        // Helper to parse duration "HH:MM:SS" to decimal hours
        const parseDuration = (duration: string): number => {
            if (!duration) return 0;
            const parts = duration.split(':').map(p => parseFloat(p) || 0);
            if (parts.length === 3) {
                return parts[0] + parts[1] / 60 + parts[2] / 3600;
            } else if (parts.length === 2) {
                return parts[0] + parts[1] / 60;
            }
            return 0;
        };

        // 5. Build Cost Map with priority: OB > PO > MFG > ADJ
        const costMap = new Map<string, number>();
        let obCount = 0, poCount = 0, mfgCount = 0, adjCount = 0;

        // Build ingredient cost lookup for manufacturing
        const ingredientCostMap = new Map<string, number>();
        obs.forEach((ob: any) => {
            const skuId = (ob.sku?._id || ob.sku)?.toString();
            if (skuId && ob.lotNumber) {
                ingredientCostMap.set(`${skuId}:${ob.lotNumber}`, ob.cost || 0);
            }
        });
        pos.forEach((po: any) => {
            po.lineItems?.forEach((item: any) => {
                const skuId = (item.sku?._id || item.sku)?.toString();
                if (skuId && item.lotNumber && !ingredientCostMap.has(`${skuId}:${item.lotNumber}`)) {
                    ingredientCostMap.set(`${skuId}:${item.lotNumber}`, item.cost || item.price || 0);
                }
            });
        });

        // Priority 1: Opening Balance
        obs.forEach((ob: any) => {
            const skuId = (ob.sku?._id || ob.sku)?.toString();
            if (skuId && ob.lotNumber) {
                const key = `${skuId}:${ob.lotNumber}`;
                if (!costMap.has(key)) {
                    costMap.set(key, ob.cost || 0);
                    obCount++;
                }
            }
        });

        // Priority 2: Purchase Order
        pos.forEach((po: any) => {
            po.lineItems?.forEach((item: any) => {
                const skuId = (item.sku?._id || item.sku)?.toString();
                if (skuId && item.lotNumber) {
                    const key = `${skuId}:${item.lotNumber}`;
                    if (!costMap.has(key)) {
                        costMap.set(key, item.cost || item.price || 0);
                        poCount++;
                    }
                }
            });
        });

        // Priority 3: Manufacturing (calculate cost from labor + ingredients like the lots API does)
        mfgs.forEach((job: any) => {
            const skuId = (job.sku?._id || job.sku)?.toString();
            const lot = job.lotNumber || job.label;
            if (skuId && lot) {
                const key = `${skuId}:${lot}`;
                if (!costMap.has(key)) {
                    let mfgCost = 0;
                    
                    if (job.totalCost && job.qty) {
                        mfgCost = job.totalCost / job.qty;
                    } else {
                        // Calculate from labor and ingredients (same as lots API)
                        let laborCost = 0;
                        let ingredientCost = 0;
                        
                        if (job.labor && Array.isArray(job.labor)) {
                            job.labor.forEach((labor: any) => {
                                const hours = parseDuration(labor.duration);
                                laborCost += hours * (labor.hourlyRate || 0);
                            });
                        }
                        
                        if (job.lineItems && Array.isArray(job.lineItems)) {
                            job.lineItems.forEach((item: any) => {
                                const itemSkuId = (item.sku?._id || item.sku)?.toString();
                                const bomQty = (item.recipeQty || 0) * (job.qty || 0);
                                const qtyExtra = item.qtyExtra || 0;
                                const qtyScrapped = item.qtyScrapped || 0;
                                const totalConsumed = bomQty + qtyExtra + qtyScrapped;
                                const unitCost = ingredientCostMap.get(`${itemSkuId}:${item.lotNumber}`) || 0;
                                ingredientCost += totalConsumed * unitCost;
                            });
                        }
                        
                        const totalJobCost = laborCost + ingredientCost;
                        mfgCost = job.qty ? totalJobCost / job.qty : 0;
                    }
                    
                    costMap.set(key, mfgCost);
                    mfgCount++;
                }
            }
        });

        // Priority 4: Audit Adjustments
        adjs.forEach((adj: any) => {
            const skuId = (adj.sku?._id || adj.sku)?.toString();
            if (skuId && adj.lotNumber) {
                const key = `${skuId}:${adj.lotNumber}`;
                if (!costMap.has(key)) {
                    costMap.set(key, adj.cost || 0);
                    adjCount++;
                }
            }
        });

        // 6. Build Bulk Ops
        const bulkOps: any[] = [];
        let matchedItems = 0;
        let totalLineItems = 0;
        
        orders.forEach((o: any) => {
            o.lineItems?.forEach((item: any) => {
                totalLineItems++;
                if (item.sku && item.lotNumber) {
                    const skuStr = (item.sku?._id || item.sku)?.toString().trim();
                    const lotStr = item.lotNumber?.toString().trim();
                    const lookupKey = `${skuStr}:${lotStr}`;
                    
                    if (costMap.has(lookupKey)) {
                        const newCost = costMap.get(lookupKey) || 0;
                        const currentCost = item.cost || 0;
                        
                        matchedItems++;

                        if (Math.abs(currentCost - newCost) > 0.001) {
                            bulkOps.push({
                                updateOne: {
                                    filter: { _id: o._id, "lineItems._id": item._id },
                                    update: { $set: { "lineItems.$.cost": newCost } }
                                }
                            });
                        }
                    }
                }
            });
        });

        // 7. Execute
        let updatedCount = 0;
        if (bulkOps.length > 0) {
            const res = await SaleOrder.bulkWrite(bulkOps);
            updatedCount = res.modifiedCount;
        }

        return NextResponse.json({ 
            processed: orders.length, 
            ops: bulkOps.length, 
            updated: updatedCount,
            stats: {
                totalLineItems,
                uniquePairs: needed.size,
                uniqueSkus: uniqueSkus.length,
                costMapSize: costMap.size,
                matchedItems,
                sources: {
                    openingBalance: obCount,
                    purchaseOrder: poCount,
                    manufacturing: mfgCount,
                    auditAdjustment: adjCount
                }
            }
        });

    } catch (error: any) {
        console.error("Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
