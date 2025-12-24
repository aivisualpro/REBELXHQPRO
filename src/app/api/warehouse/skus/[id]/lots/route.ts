import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import Client from '@/models/Client';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        
        // Ensure models are registered
        void Client;
        void AuditAdjustment;

        const params = await props.params;
        const { id } = params;

        const sku = await Sku.findOne({ _id: id }).lean();
        if (!sku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        const startDate = await getGlobalStartDate();
        const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};

        // First, get manufacturing jobs to collect all ingredient SKU IDs
        const manufacturingJobsRaw = await Manufacturing.find({
            $or: [{ sku: id }, { "lineItems.sku": id }],
            ...dateFilter
        }).lean();

        // Collect all unique SKU IDs from manufacturing lineItems (ingredients)
        const ingredientSkuIds = new Set<string>();
        manufacturingJobsRaw.forEach((job: any) => {
            job.lineItems?.forEach((item: any) => {
                const skuId = (typeof item.sku === 'object' && item.sku !== null) ? item.sku._id : item.sku;
                if (skuId) ingredientSkuIds.add(skuId.toString());
            });
        });

        const [
            openingBalances,
            purchaseOrders,
            saleOrders,
            adjustments,
            webOrders,
            // Fetch ALL opening balances and POs for ingredient cost lookups
            allIngredientOBs,
            allIngredientPOs
        ] = await Promise.all([
            OpeningBalance.find({ sku: id, ...dateFilter }).lean(),
            PurchaseOrder.find({ "lineItems.sku": id, ...dateFilter }).lean(),
            SaleOrder.find({ "lineItems.sku": id, ...dateFilter }).lean(),
            AuditAdjustment.find({ sku: id, ...dateFilter }).lean(),
            WebOrder.find({
                 "lineItems.sku": id,
                 status: { $in: ['completed', 'shipped', 'Completed', 'Shipped'] }, 
                 ...dateFilter
            }).lean(),
            // Fetch ingredient cost sources (all OBs for ingredient SKUs)
            ingredientSkuIds.size > 0 
                ? OpeningBalance.find({ sku: { $in: Array.from(ingredientSkuIds) } }).select('sku lotNumber cost').lean()
                : Promise.resolve([]),
            // Fetch ingredient cost sources (all POs for ingredient SKUs)
            ingredientSkuIds.size > 0
                ? PurchaseOrder.find({ "lineItems.sku": { $in: Array.from(ingredientSkuIds) } }).select('lineItems').lean()
                : Promise.resolve([])
        ]);

        const manufacturingJobs = manufacturingJobsRaw; // Already fetched

        // Helper function to get ingredient cost by SKU and lot number
        const getIngredientCost = (skuId: string, lotNumber: string): number => {
            if (!skuId || !lotNumber) return 0;
            
            // Check Opening Balances first
            const ob = allIngredientOBs.find((o: any) => 
                o.sku?.toString() === skuId && o.lotNumber === lotNumber
            );
            if (ob) return ob.cost || 0;
            
            // Check Purchase Orders
            for (const po of allIngredientPOs) {
                const line = po.lineItems?.find((l: any) => {
                    const lSku = (typeof l.sku === 'object' && l.sku !== null) ? l.sku._id : l.sku;
                    return lSku?.toString() === skuId && l.lotNumber === lotNumber;
                });
                if (line) return line.cost || line.price || 0;
            }
            
            return 0;
        };

        const lotBalances = new Map<string, number>();
        const lotMetadata = new Map<string, { source: string, date: string, cost: number }>();

        const registerLot = (lot: string, qty: number, source?: string, date?: string | Date, isSource: boolean = false, cost: number = 0) => {
            const normLot = lot ? lot.trim() : 'N/A';
            if (normLot === 'N/A') return;

            const current = lotBalances.get(normLot) || 0;
            lotBalances.set(normLot, current + qty);

            // Capture source metadata if it's a source transaction and we haven't set it yet
            if (isSource && source && date && !lotMetadata.has(normLot)) {
                lotMetadata.set(normLot, { source, date: new Date(date).toISOString(), cost: cost || 0 });
            }
        };

        // Process Opening Balances
        openingBalances.forEach((ob: any) => {
            registerLot(ob.lotNumber, ob.qty || 0, 'Opening Balance', ob.createdAt, true, ob.cost || 0);
        });

        // Process Purchase Orders
        purchaseOrders.forEach((po: any) => {
            const lines = po.lineItems.filter((line: any) => line.sku?.toString() === id);
            lines.forEach((line: any) => {
                if (line.qtyReceived > 0) {
                     const date = po.receivedDate || po.createdAt;
                     registerLot(line.lotNumber, line.qtyReceived, `PO #${po.label || po._id}`, date, true, line.cost || line.price || 0);
                }
            });
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

        // Process Manufacturing
        manufacturingJobs.forEach((job: any) => {
            // Handle both populated and non-populated sku field
            const jobSkuId = (typeof job.sku === 'object' && job.sku !== null) ? job.sku._id : job.sku;
            
            if (jobSkuId?.toString() === id) {
                let manufacturingCost = 0;
                
                // First try to use totalCost if available
                if (job.totalCost && job.qty) {
                    manufacturingCost = job.totalCost / job.qty;
                } else {
                    // Calculate from labor and ingredients
                    let laborCost = 0;
                    let ingredientCost = 0;
                    
                    // Sum labor costs
                    if (job.labor && Array.isArray(job.labor)) {
                        job.labor.forEach((labor: any) => {
                            const hours = parseDuration(labor.duration);
                            laborCost += hours * (labor.hourlyRate || 0);
                        });
                    }
                    
                    // Sum ingredient costs - lookup costs from OpeningBalance/PurchaseOrder
                    if (job.lineItems && Array.isArray(job.lineItems)) {
                        job.lineItems.forEach((item: any) => {
                            const itemSkuId = (typeof item.sku === 'object' && item.sku !== null) ? item.sku._id : item.sku;
                            // recipeQty is per-unit, multiply by job.qty to get total consumed
                            const bomQty = (item.recipeQty || 0) * (job.qty || 0);
                            const qtyExtra = item.qtyExtra || 0;
                            const qtyScrapped = item.qtyScrapped || 0;
                            const totalConsumed = bomQty + qtyExtra + qtyScrapped;
                            // Look up ingredient cost from OpeningBalance or PurchaseOrder
                            const unitCost = getIngredientCost(itemSkuId?.toString(), item.lotNumber);
                            ingredientCost += totalConsumed * unitCost;
                        });
                    }
                    
                    const totalJobCost = laborCost + ingredientCost;
                    manufacturingCost = job.qty ? totalJobCost / job.qty : 0;
                }
                
                registerLot(job.lotNumber || job.label, job.qty || 0, `Manufacturing`, job.createdAt, true, manufacturingCost);
            }
            if (job.lineItems && Array.isArray(job.lineItems)) {
                const ingredients = job.lineItems.filter((line: any) => {
                    const lineSkuId = (typeof line.sku === 'object' && line.sku !== null) ? line.sku._id : line.sku;
                    return lineSkuId?.toString() === id;
                });
                ingredients.forEach((line: any) => {
                    const consumed = (line.recipeQty || 0) + (line.qtyExtra || 0);
                    if (consumed > 0) {
                        registerLot(line.lotNumber, -consumed);
                    }
                });
            }
        });

        // Process Sale Orders
        saleOrders.forEach((so: any) => {
            const lines = so.lineItems.filter((line: any) => line.sku?.toString() === id);
            lines.forEach((line: any) => {
                if (line.qtyShipped > 0) {
                    registerLot(line.lotNumber, -Math.abs(line.qtyShipped));
                }
            });
        });

        // Process Audit Adjustments
        adjustments.forEach((adj: any) => {
             const isAdd = (adj.qty || 0) > 0;
             registerLot(adj.lotNumber, adj.qty, 'Audit Adjustment', adj.createdAt, isAdd, adj.cost || 0);
        });

        // Process Web Orders
        webOrders.forEach((wo: any) => {
             const lines = wo.lineItems.filter((line: any) => {
                 const lineSkuId = (typeof line.sku === 'object' && line.sku !== null) ? line.sku._id : line.sku;
                 return lineSkuId?.toString() === id;
             });
             lines.forEach((line: any) => {
                  registerLot(line.lotNumber, -Math.abs(line.qty || 0));
             });
        });

        const results = Array.from(lotBalances.entries())
            .map(([lotNumber, balance]) => {
                const meta = lotMetadata.get(lotNumber);
                return { 
                    lotNumber, 
                    balance,
                    source: meta?.source || 'Unknown Source',
                    date: meta?.date || null,
                    cost: meta?.cost || 0
                };
            })
            .sort((a, b) => b.balance - a.balance);

        return NextResponse.json({
            sku,
            lots: results
        });

    } catch (error: any) {
        console.error("Error fetching SKU lots:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
