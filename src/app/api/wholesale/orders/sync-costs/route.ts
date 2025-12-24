import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s execution

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
            return NextResponse.json({ processed: 0, ops: 0 });
        }

        // 2. Identify Unique (SKU, Lot) pairs needed
        const needed = new Set<string>();
         orders.forEach((o: any) => {
            o.lineItems?.forEach((item: any) => {
                // Ensure we use trimmed strings
                const sku = (item.sku?._id || item.sku)?.toString().trim();
                const lot = item.lotNumber?.toString().trim();
                
                if (sku && lot) {
                    needed.add(`${sku}:${lot}`);
                }
            });
        });

        if (needed.size === 0) {
            return NextResponse.json({ processed: orders.length, ops: 0 });
        }

        // 3. Fetch Costs
        const pairs = Array.from(needed).map(s => {
             // Use lastIndexOf to split safe in case SKU has colon? Unlikely but safe.
            const idx = s.lastIndexOf(':');
            return { sku: s.substring(0, idx), lot: s.substring(idx + 1) };
        });

        const uniqueSkus = Array.from(new Set(pairs.map(p => p.sku)));
        // Create matching set of ObjectIds for valid hex strings to handle ObjectId vs String storage
        const validOids = uniqueSkus.filter(s => mongoose.Types.ObjectId.isValid(s)).map(s => new mongoose.Types.ObjectId(s));
        const searchSkus = [...uniqueSkus, ...validOids];
        
        const [obs, pos, mfgs, adjs] = await Promise.all([
            OpeningBalance.find({ 
                 sku: { $in: searchSkus }
            } as any).select('sku lotNumber cost').lean(),
            PurchaseOrder.find({
                "lineItems.sku": { $in: searchSkus }
            } as any).select('lineItems').lean(),
            Manufacturing.find({
                sku: { $in: searchSkus } // Only care about output SKU match
            } as any).select('sku lotNumber label totalCost qty').lean(),
            AuditAdjustment.find({
                sku: { $in: searchSkus }
            } as any).select('sku lotNumber cost qty').lean()
        ]);

        // 4. Build Cost Map
        const costMap = new Map<string, number>();

        // Priority 1: Opening Balance
        let obMatchCount = 0;
        obs.forEach((ob: any) => {
            const skuId = (ob.sku?._id || ob.sku)?.toString();
            if (skuId && ob.lotNumber) {
                const key = `${skuId}:${ob.lotNumber}`;
                const val = ob.cost || 0;
                // Prefer higher cost if duplicates exist (e.g. 0 vs 1.99)
                const existing = costMap.get(key);
                if (existing === undefined || val > existing) {
                    costMap.set(key, val);
                    if (existing === undefined) obMatchCount++;
                }
            }
        });
        console.log(`[SyncCosts] Indexed ${obMatchCount} unique costs from ${obs.length} OpeningBalances`);

        // Priority 2: Purchase Order
        let poMatchCount = 0;
        pos.forEach((po: any) => {
            po.lineItems?.forEach((item: any) => {
                const skuId = (item.sku?._id || item.sku)?.toString();
                if (skuId && item.lotNumber) {
                    const key = `${skuId}:${item.lotNumber}`;
                    const c = item.cost !== undefined ? item.cost : (item.price || 0);
                    
                    // Only set if not already set by OB
                    if (!costMap.has(key)) {
                        costMap.set(key, c);
                        poMatchCount++;
                    }
                }
            });
        });
        console.log(`[SyncCosts] Indexed ${poMatchCount} unique costs from ${pos.length} PurchaseOrders`);

        // Priority 3: Manufacturing
        let mfgMatchCount = 0;
        mfgs.forEach((job: any) => {
            const skuId = (job.sku?._id || job.sku)?.toString();
            const lot = job.lotNumber || job.label; // Mfg uses lotNumber OR label if missing
            if (skuId && lot) {
                const key = `${skuId}:${lot}`;
                // Calculate unit cost
                let c = 0;
                if (job.totalCost && job.qty) {
                    c = job.totalCost / job.qty;
                }
                
                // Only set if not already set by OB or PO (Sources precedence)
                if (!costMap.has(key)) {
                    costMap.set(key, c);
                    mfgMatchCount++;
                }
            }
        });
         console.log(`[SyncCosts] Indexed ${mfgMatchCount} unique costs from ${mfgs.length} ManufacturingJobs`);

        // Priority 4: Audit Adjustments
        let adjMatchCount = 0;
        adjs.forEach((adj: any) => {
             const skuId = (adj.sku?._id || adj.sku)?.toString();
            if (skuId && adj.lotNumber) {
                const key = `${skuId}:${adj.lotNumber}`;
                const c = adj.cost || 0;
                
                if (!costMap.has(key)) {
                    costMap.set(key, c);
                    adjMatchCount++;
                }
            }
        });
        console.log(`[SyncCosts] Indexed ${adjMatchCount} unique costs from ${adjs.length} AuditAdjustments`);

        // 5. Build Bulk Ops
        const bulkOps: any[] = [];
        let matchedItems = 0;
        
        orders.forEach((o: any) => {
            o.lineItems?.forEach((item: any) => {
                if (item.sku && item.lotNumber) {
                    // SKU might be object or string in lineItems (if mixed types exist)
                    const skuStr = (item.sku?._id || item.sku)?.toString().trim();
                    const key = `${skuStr}:${item.lotNumber}`; // Note: lotNumber trimmed above in 'needed' loop but here we access item raw. Needs trim.
                    // Wait, we generate key from item.
                    const lotStr = item.lotNumber?.toString().trim();
                     const lookupKey = `${skuStr}:${lotStr}`;
                    
                    if (costMap.has(lookupKey)) {
                        const newCost = costMap.get(lookupKey);
                        const currentCost = item.cost || 0;
                        
                        // Debug log for first few matches
                        if (matchedItems < 5) {
                            console.log(`[SyncCosts] Sample Match: ${lookupKey} | Current: ${currentCost} | Map(New): ${newCost}`);
                        }

                        // Use loose equality for float (epsilon 0.001)
                        if (Math.abs(currentCost - (newCost || 0)) > 0.001) {
                            bulkOps.push({
                                updateOne: {
                                    filter: { _id: o._id, "lineItems._id": item._id },
                                    update: { $set: { "lineItems.$.cost": newCost } }
                                }
                            });
                        }
                        matchedItems++;
                    }
                }
            });
        });
        
        console.log(`[SyncCosts] Batch of ${orders.length} orders. Found ${matchedItems} line items matching known costs. Generated ${bulkOps.length} updates.`);

        // 6. Execute
        let updatedCount = 0;
        if (bulkOps.length > 0) {
            const res = await SaleOrder.bulkWrite(bulkOps);
            updatedCount = res.modifiedCount;
            console.log(`[SyncCosts] BulkWrite modified ${updatedCount} documents.`);
        }

        return NextResponse.json({ 
            processed: orders.length, 
            ops: bulkOps.length, 
            updated: updatedCount,
            debug: { obMatch: obMatchCount, poMatch: poMatchCount, mfgMatch: mfgMatchCount, adjMatch: adjMatchCount, matchedItems }
        });

    } catch (error: any) {
        console.error("Sync Error Detailed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
