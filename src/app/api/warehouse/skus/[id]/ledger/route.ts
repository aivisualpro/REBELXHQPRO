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
import Setting from '@/models/Setting';
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

        // Await params object for Next.js 15+ compatibility
        const params = await props.params;
        const { id } = params;

        const sku = await Sku.findById(id).lean();
        if (!sku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        const varianceIds = sku.variances?.map((v: any) => v._id) || [];

        // 0. Get Global Date Filter
        const startDate = await getGlobalStartDate();
        const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};

        // 1. Opening Balances
        const openingBalances = await OpeningBalance.find({ sku: id, ...dateFilter }).lean();

        // 2. Purchase Orders (Incoming)
        const purchaseOrders = await PurchaseOrder.find({
            "lineItems.sku": id,
            ...dateFilter
        }).populate('vendor', 'name').lean();

        // 3. Manufacturing
        // Case A: Product Produced (Output) - 'sku' matches id
        // Case B: Ingredient Consumed (Input) - 'lineItems.sku' matches id
        const manufacturingJobs = await Manufacturing.find({
            $or: [
                { sku: id },
                { "lineItems.sku": id }
            ],
            ...dateFilter
        }).lean();

        // 4. Sale Orders (Outgoing)
        const saleOrders = await SaleOrder.find({
            "lineItems.sku": id,
            ...dateFilter
        }).populate('clientId', 'name').lean();

        // 5. Audit Adjustments
        const adjustments = await AuditAdjustment.find({
            sku: id,
            ...dateFilter
        }).lean();

        // 6. Web Orders (Retail)
        // 6. Web Orders (Retail)
        const webOrders = await WebOrder.find({
             $or: [
                 { "lineItems.sku": id },
                 { "lineItems.varianceId": { $in: varianceIds } }
             ],
             status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'] }, 
             ...dateFilter
        }).lean();

        let transactions: any[] = [];

        // Process Opening Balances
        openingBalances.forEach((ob: any) => {
            transactions.push({
                _id: ob._id,
                date: new Date(ob.createdAt),
                type: 'Opening',
                reference: ob._id.toString(), // Use ID as requested
                lotNumber: ob.lotNumber || 'N/A',
                quantity: ob.qty,
                uom: ob.uom,
                cost: ob.cost || 0,
                docId: ob._id,
                link: `/warehouse/opening-balances/${ob._id}` 
            });
        });

        // Process Purchase Orders
        purchaseOrders.forEach((po: any) => {
            // Find relevant line items
            const lines = po.lineItems.filter((line: any) => line.sku?.toString() === id);
            
            lines.forEach((line: any) => {
                if (line.qtyReceived > 0) {
                    transactions.push({
                        _id: line._id,
                        date: line.receivedDate ? new Date(line.receivedDate) : new Date(po.createdAt),
                        type: 'Purchase Order',
                        reference: po.label, // Just label
                        lotNumber: line.lotNumber || '',
                        quantity: line.qtyReceived,
                        uom: line.uom,
                        cost: line.cost || 0,
                        docId: po._id,
                        link: `/warehouse/purchase-orders/${po._id}`
                    });
                }
            });
        });

        // Helper to convert HH:MM:SS to decimal hours
        const durationToHours = (duration: string) => {
            const parts = (duration || '0:0:0').split(':');
            return parseInt(parts[0] || '0') + 
                   parseInt(parts[1] || '0') / 60 + 
                   parseInt(parts[2] || '0') / 3600;
        };

        // COLLECT INGREDIENT COSTS FOR PRODUCED JOBS
        const producedJobs = manufacturingJobs.filter((j: any) => j.sku?.toString() === id);
        const ingredientInfo: { sku: string, lotNumber: string }[] = [];
        producedJobs.forEach((job: any) => {
            job.lineItems?.forEach((li: any) => {
                const liSkuId = li.sku?._id || li.sku;
                if (liSkuId && li.lotNumber) {
                    ingredientInfo.push({ sku: liSkuId.toString(), lotNumber: li.lotNumber });
                }
            });
        });

        // Deduplicate ingredients to fetch costs in bulk
        const uniqueIngredients = ingredientInfo.reduce((acc: any[], curr) => {
            if (!acc.some(i => i.sku === curr.sku && i.lotNumber === curr.lotNumber)) {
                acc.push(curr);
            }
            return acc;
        }, []);

        // Fetch Opening Balances and Purchase Orders for all unique ingredients
        const [ingObs, ingPos] = await Promise.all([
            OpeningBalance.find({
                sku: { $in: uniqueIngredients.map(i => i.sku) },
                lotNumber: { $in: uniqueIngredients.map(i => i.lotNumber) }
            }).select('sku lotNumber cost').lean(),
            PurchaseOrder.find({
                "lineItems": {
                    $elemMatch: {
                        sku: { $in: uniqueIngredients.map(i => i.sku) },
                        lotNumber: { $in: uniqueIngredients.map(i => i.lotNumber) }
                    }
                }
            }).select('lineItems').lean()
        ]);

        const getIngredientCost = (skuId: string, lot: string) => {
            const ob = ingObs.find(o => o.sku.toString() === skuId && o.lotNumber === lot);
            if (ob) return ob.cost || 0;
            for (const po of ingPos) {
                const line = po.lineItems.find((l: any) => {
                    const lSku = l.sku?._id || l.sku;
                    return lSku?.toString() === skuId && l.lotNumber === lot;
                });
                if (line) return line.cost || 0;
            }
            return 0;
        };

        // Process Manufacturing
        manufacturingJobs.forEach((job: any) => {
            // Check if Output (Produced)
            if (job.sku?.toString() === id) {
                let totalMatCost = 0;
                job.lineItems?.forEach((li: any) => {
                    const liSkuId = li.sku?._id || li.sku;
                    if (!liSkuId) return;

                    const bomQty = (li.recipeQty || 0) * (job.qty || 0);
                    const qtyExtra = li.qtyExtra || 0;
                    const qtyScrapped = li.qtyScrapped || 0;
                    const totalConsumed = bomQty + qtyExtra + qtyScrapped;
                    
                    const unitCost = getIngredientCost(liSkuId.toString(), li.lotNumber);
                    totalMatCost += totalConsumed * unitCost;
                });

                let totalLaborCost = 0;
                job.labor?.forEach((l: any) => {
                    const hours = durationToHours(l.duration);
                    totalLaborCost += hours * (l.hourlyRate || 0);
                });

                const totalUnitCost = totalMatCost + totalLaborCost;
                const totalQty = (job.qty || 0) + (job.qtyDifference || 0);
                const costPerUnit = totalQty > 0 ? totalUnitCost / totalQty : 0;

                transactions.push({
                    _id: job._id + '_prod',
                    date: job.scheduledFinish ? new Date(job.scheduledFinish) : new Date(job.createdAt),
                    type: 'Produced',
                    reference: job.label || 'Production',
                    lotNumber: job.lotNumber || job.label || '',
                    quantity: job.qty || 0,
                    uom: job.uom,
                    cost: costPerUnit,
                    docId: job._id,
                    link: `/warehouse/manufacturing/${job._id}`
                });
            }

            // Check if Input (Ingredient Consumption)
            if (job.lineItems && Array.isArray(job.lineItems)) {
                const ingredients = job.lineItems.filter((line: any) => {
                    const lineSkuId = line.sku?._id || line.sku;
                    return lineSkuId?.toString() === id;
                });
                ingredients.forEach((line: any) => {
                    const consumed = (line.recipeQty || 0) + (line.qtyExtra || 0);
                    if (consumed > 0) {
                        let cost = 0;
                        if (line.lotNumber) {
                             // This is our SKU being consumed, so we can use openingBalances or purchaseOrders pre-fetched for 'id'
                             const matchingOb = openingBalances.find((ob: any) => ob.lotNumber === line.lotNumber);
                             if (matchingOb) {
                                 cost = matchingOb.cost || 0;
                             } else {
                                 for (const po of purchaseOrders) {
                                     const poLine = (po as any).lineItems.find((l: any) => {
                                         const lSku = l.sku?._id || l.sku;
                                         return lSku?.toString() === id && l.lotNumber === line.lotNumber;
                                     });
                                     if (poLine) {
                                         cost = poLine.cost || 0;
                                         break;
                                     }
                                 }
                             }
                        }

                        transactions.push({
                            _id: line._id,
                            date: line.createdAt ? new Date(line.createdAt) : (job.scheduledStart ? new Date(job.scheduledStart) : new Date(job.createdAt)),
                            type: 'Consumption',
                            reference: job.label || 'Production',
                            lotNumber: line.lotNumber || '',
                            quantity: -consumed,
                            uom: line.uom,
                            cost: cost,
                            docId: job._id,
                            link: `/warehouse/manufacturing/${job._id}`
                        });
                    }
                });
            }
        });

        // Process Sale Orders
        saleOrders.forEach((so: any) => {
            const lines = so.lineItems.filter((line: any) => line.sku?.toString() === id);
            
            lines.forEach((line: any) => {
                if (line.qtyShipped > 0) {
                     let cost = 0;
                     if (line.lotNumber) {
                         // Check fetched Opening Balances
                         const matchingOb = openingBalances.find((ob: any) => ob.lotNumber === line.lotNumber);
                         if (matchingOb) {
                             cost = matchingOb.cost || 0;
                         } else {
                             // Check fetched Purchase Orders
                             for (const po of purchaseOrders) {
                                 const poLine = (po as any).lineItems.find((l: any) => 
                                     (l.sku?._id?.toString() === id || l.sku?.toString() === id) && 
                                     l.lotNumber === line.lotNumber
                                 );
                                 if (poLine) {
                                     cost = poLine.cost || 0;
                                     break;
                                 }
                             }
                         }
                     }

                     transactions.push({
                        _id: line._id,
                        date: so.shippedDate ? new Date(so.shippedDate) : new Date(so.createdAt),
                        type: 'Orders',
                        reference: so.label, 
                        lotNumber: line.lotNumber || '',
                        quantity: -Math.abs(line.qtyShipped), 
                        uom: line.uom,
                        cost: cost,
                        docId: so._id,
                        link: `/wholesale/orders/${so._id}`
                    });
                }
            });
        });

        // Process Audit Adjustments
        adjustments.forEach((adj: any) => {
            transactions.push({
                _id: adj._id,
                date: new Date(adj.createdAt),
                type: 'Audit',
                reference: '', // Empty as requested
                lotNumber: adj.lotNumber || 'N/A',
                quantity: adj.qty,
                uom: sku.uom || 'Unit',
                cost: adj.cost || 0,
                docId: adj._id,
                link: `/warehouse/audit-adjustments` // Since we don't have a detail page yet, just valid link or back to list
            });
        });

        // Process Web Orders
        webOrders.forEach((wo: any) => {
             const lines = wo.lineItems.filter((line: any) => {
                 const lineSkuId = (typeof line.sku === 'object' && line.sku !== null) ? line.sku._id : line.sku;
                 if (lineSkuId?.toString() === id) return true;
                 if (line.varianceId && varianceIds.includes(line.varianceId)) return true;
                 return false;
             });

             lines.forEach((line: any) => {
                  let cost = 0;
                  if (line.lotNumber) {
                       const matchingOb = openingBalances.find((ob: any) => ob.lotNumber === line.lotNumber);
                       if (matchingOb) {
                           cost = matchingOb.cost || 0;
                       } else {
                           for (const po of purchaseOrders) {
                               const poLine = (po as any).lineItems.find((l: any) => 
                                   (l.sku?._id?.toString() === id || l.sku?.toString() === id) && 
                                   l.lotNumber === line.lotNumber
                               );
                               if (poLine) {
                                   cost = poLine.cost || 0;
                                   break;
                               }
                           }
                       }
                  }

                  transactions.push({
                      _id: line._id || `${wo._id}_${id}`,
                      date: new Date(wo.createdAt),
                      type: 'Web Order',
                      reference: line.varianceId ? `${wo._id} (${line.varianceId})` : wo._id,
                      lotNumber: line.lotNumber || 'N/A',
                      quantity: -Math.abs(line.qty || 0), // Outgoing
                      uom: 'Unit',
                      cost: cost,
                      docId: wo._id,
                      link: `/retail/web-orders/${wo._id}`,
                      varianceId: line.varianceId, // Use varianceId or fallback to _id if user implied that
                      website: line.website
                  });
             });
        });

        // Sort by Date ASC (Oldest first)
        transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

        if (startDate) {
            transactions = transactions.filter(t => t.date >= startDate);
        }

        // Calculate Running Balance
        let balance = 0;
        transactions = transactions.map(t => {
            balance += t.quantity;
            return { ...t, balance };
        });

        // DO NOT REVERSE: User wants oldest to newest (ascending), so new transactions are at bottom.
        // transactions.reverse();

        return NextResponse.json({
            sku,
            transactions,
            totalCount: transactions.length,
            debugStartDate: startDate, // Helpful for debugging
            settings: {
                missingSkuImage: (await Setting.findOne({ key: 'missingSkuImage' }).lean())?.value || ''
            }
        });

    } catch (error: any) {
        console.error("Error fetching SKU ledger:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
