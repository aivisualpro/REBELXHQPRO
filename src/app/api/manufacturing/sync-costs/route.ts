import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import AuditAdjustment from '@/models/AuditAdjustment';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();
        const { skip = 0, limit = 500, orderIds } = body;

        const query: any = {};
        if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
            query._id = { $in: orderIds };
        }

        // 1. Fetch Batch of Manufacturing Jobs with full lineItems data
        const jobs = await Manufacturing.find(query)
            .select('sku qty lotNumber label lineItems labor materialCost packagingCost laborCost totalCost')
            .skip(skip)
            .limit(limit)
            .lean();

        if (jobs.length === 0) {
            return NextResponse.json({ processed: 0, ops: 0, stats: { message: 'No jobs in this batch' } });
        }

        // 2. Collect all ingredient SKU IDs for cost lookups
        const ingredientSkuIds = new Set<string>();
        
        jobs.forEach((job: any) => {
            job.lineItems?.forEach((item: any) => {
                const skuId = (item.sku?._id || item.sku)?.toString();
                if (skuId) ingredientSkuIds.add(skuId);
            });
        });

        // 3. Fetch ingredient SKU details to determine category (Material vs Packaging)
        const skuDetails = await Sku.find({ _id: { $in: Array.from(ingredientSkuIds) } } as any)
            .select('_id category')
            .lean();
        
        const skuCategoryMap = new Map<string, string>();
        skuDetails.forEach((sku: any) => {
            skuCategoryMap.set(sku._id?.toString(), sku.category?.toLowerCase() || '');
        });

        // 4. Fetch costs for all ingredients from all sources (OB -> PO -> MFG -> ADJ priority)
        const searchSkus = Array.from(ingredientSkuIds);
        const validOids = searchSkus.filter(s => mongoose.Types.ObjectId.isValid(s)).map(s => new mongoose.Types.ObjectId(s));
        const allSearchSkus = [...searchSkus, ...validOids];

        const [obs, pos, mfgs, adjs] = await Promise.all([
            OpeningBalance.find({ sku: { $in: allSearchSkus } } as any).select('sku lotNumber cost').lean(),
            PurchaseOrder.find({ "lineItems.sku": { $in: allSearchSkus } } as any).select('lineItems').lean(),
            Manufacturing.find({ sku: { $in: allSearchSkus } } as any).select('sku lotNumber label totalCost qty lineItems labor').lean(),
            AuditAdjustment.find({ sku: { $in: allSearchSkus } } as any).select('sku lotNumber cost').lean()
        ]);

        // Helper to parse duration "HH:MM:SS" to decimal hours
        const parseDurationForIngredient = (duration: string): number => {
            if (!duration) return 0;
            const parts = duration.split(':').map(p => parseFloat(p) || 0);
            if (parts.length === 3) {
                return parts[0] + parts[1] / 60 + parts[2] / 3600;
            } else if (parts.length === 2) {
                return parts[0] + parts[1] / 60;
            }
            return 0;
        };

        // 5. Build ingredient cost map (SKU:LotNumber -> cost) with priority OB -> PO -> MFG -> ADJ
        const ingredientCostMap = new Map<string, number>();
        let obCount = 0, poCount = 0, mfgCount = 0, adjCount = 0;

        // Priority 1: Opening Balance
        obs.forEach((ob: any) => {
            const skuId = (ob.sku?._id || ob.sku)?.toString();
            if (skuId && ob.lotNumber) {
                const key = `${skuId}:${ob.lotNumber}`;
                if (!ingredientCostMap.has(key)) {
                    ingredientCostMap.set(key, ob.cost || 0);
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
                    if (!ingredientCostMap.has(key)) {
                        ingredientCostMap.set(key, item.cost || item.price || 0);
                        poCount++;
                    }
                }
            });
        });

        // Priority 3: Manufacturing (calculate unit cost from labor + ingredients)
        mfgs.forEach((mfgJob: any) => {
            const skuId = (mfgJob.sku?._id || mfgJob.sku)?.toString();
            const lot = mfgJob.lotNumber || mfgJob.label;
            if (skuId && lot) {
                const key = `${skuId}:${lot}`;
                if (!ingredientCostMap.has(key)) {
                    let mfgCost = 0;
                    
                    if (mfgJob.totalCost && mfgJob.qty) {
                        mfgCost = mfgJob.totalCost / mfgJob.qty;
                    } else {
                        // Calculate from labor and ingredients
                        let laborCost = 0;
                        let ingredientCost = 0;
                        
                        if (mfgJob.labor && Array.isArray(mfgJob.labor)) {
                            mfgJob.labor.forEach((labor: any) => {
                                const hours = parseDurationForIngredient(labor.duration);
                                laborCost += hours * (labor.hourlyRate || 0);
                            });
                        }
                        
                        if (mfgJob.lineItems && Array.isArray(mfgJob.lineItems)) {
                            mfgJob.lineItems.forEach((item: any) => {
                                const itemSkuId = (item.sku?._id || item.sku)?.toString();
                                const bomQty = (item.recipeQty || 0) * (mfgJob.qty || 0);
                                const qtyExtra = item.qtyExtra || 0;
                                const qtyScrapped = item.qtyScrapped || 0;
                                const totalConsumed = bomQty + qtyExtra + qtyScrapped;
                                const unitCost = ingredientCostMap.get(`${itemSkuId}:${item.lotNumber}`) || 0;
                                ingredientCost += totalConsumed * unitCost;
                            });
                        }
                        
                        const totalJobCost = laborCost + ingredientCost;
                        mfgCost = mfgJob.qty ? totalJobCost / mfgJob.qty : 0;
                    }
                    
                    ingredientCostMap.set(key, mfgCost);
                    mfgCount++;
                }
            }
        });

        // Priority 4: Audit Adjustments
        adjs.forEach((adj: any) => {
            const skuId = (adj.sku?._id || adj.sku)?.toString();
            if (skuId && adj.lotNumber) {
                const key = `${skuId}:${adj.lotNumber}`;
                if (!ingredientCostMap.has(key)) {
                    ingredientCostMap.set(key, adj.cost || 0);
                    adjCount++;
                }
            }
        });

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

        // 6. Calculate costs for each job and build bulk ops
        const bulkOps: any[] = [];
        let calculatedCount = 0;
        let lineItemsUpdated = 0;

        jobs.forEach((job: any) => {
            let laborCost = 0;
            let materialCost = 0;
            let packagingCost = 0;
            let lineItemsChanged = false;
            
            // Sum labor costs
            if (job.labor && Array.isArray(job.labor)) {
                job.labor.forEach((labor: any) => {
                    const hours = parseDuration(labor.duration);
                    laborCost += hours * (labor.hourlyRate || 0);
                });
            }
            
            // Build updated lineItems with costs and calculate totals by category
            // Using SAME FORMULA as detail page:
            // bomQty = recipeQty * job.qty
            // qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0
            // totalQty = sa > 0 ? bomQty + qtyScrapped + qtyExtra : bomQty + qtyScrapped
            // itemCost = totalQty * unitCost
            const updatedLineItems = (job.lineItems || []).map((item: any) => {
                const itemSkuId = (item.sku?._id || item.sku)?.toString();
                const lookupKey = `${itemSkuId}:${item.lotNumber}`;
                const unitCost = ingredientCostMap.get(lookupKey) || 0;
                
                // Calculate consumed quantity - MATCHING DETAIL PAGE FORMULA
                const bomQty = (item.recipeQty || 0) * (job.qty || 0);
                const sa = item.sa || 0;
                const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                const qtyScrapped = item.qtyScrapped || 0;
                const totalQty = sa > 0 ? bomQty + qtyScrapped + qtyExtra : bomQty + qtyScrapped;
                
                const itemTotalCost = totalQty * unitCost;
                
                // Categorize by SKU category
                const category = skuCategoryMap.get(itemSkuId) || '';
                if (category.includes('packaging') || category.includes('pack')) {
                    packagingCost += itemTotalCost;
                } else {
                    materialCost += itemTotalCost;
                }
                
                // Check if line item cost changed
                const currentCost = item.cost || 0;
                if (Math.abs(currentCost - unitCost) > 0.0001) {
                    lineItemsChanged = true;
                    lineItemsUpdated++;
                }
                
                // Return updated line item with UNIT cost (not total)
                return {
                    ...item,
                    cost: unitCost
                };
            });
            
            const newTotalCost = laborCost + materialCost + packagingCost;
            
            // Check if any cost has changed
            const currentMat = job.materialCost || 0;
            const currentPack = job.packagingCost || 0;
            const currentLabor = job.laborCost || 0;
            const currentTotal = job.totalCost || 0;
            
            const hasChanged = 
                lineItemsChanged ||
                Math.abs(currentMat - materialCost) > 0.01 ||
                Math.abs(currentPack - packagingCost) > 0.01 ||
                Math.abs(currentLabor - laborCost) > 0.01 ||
                Math.abs(currentTotal - newTotalCost) > 0.01;
            
            calculatedCount++;

            if (hasChanged) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: job._id },
                        update: { 
                            $set: { 
                                lineItems: updatedLineItems,
                                materialCost,
                                packagingCost,
                                laborCost,
                                totalCost: newTotalCost 
                            } 
                        }
                    }
                });
            }
        });

        // 7. Execute bulk update
        let updatedCount = 0;
        if (bulkOps.length > 0) {
            const res = await Manufacturing.bulkWrite(bulkOps);
            updatedCount = res.modifiedCount;
        }

        return NextResponse.json({ 
            processed: jobs.length, 
            ops: bulkOps.length, 
            updated: updatedCount,
            stats: {
                jobs: jobs.length,
                calculatedCosts: calculatedCount,
                lineItemsUpdated,
                ingredientCostMapSize: ingredientCostMap.size,
                sources: {
                    openingBalance: obCount,
                    purchaseOrder: poCount,
                    manufacturing: mfgCount,
                    auditAdjustment: adjCount
                }
            }
        });

    } catch (error: any) {
        console.error("Manufacturing Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
