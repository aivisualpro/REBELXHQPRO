import { NextRequest, NextResponse } from 'next/server';
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
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        
        // Ensure models are registered
        void Client;
        void AuditAdjustment;

        const { id } = await context.params;

        // 0. Parallelize SKU fetch and Settings
        const [sku, startDate, settings] = await Promise.all([
            Sku.findById(id).lean(),
            getGlobalStartDate(),
            Setting.findOne({ key: 'missingSkuImage' }).select('value').lean()
        ]);

        if (!sku) {
            return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
        }

        const varianceIds = sku.variances?.map((v: any) => v._id) || [];
        const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};

        // 1. Parallelize ALL transaction queries
        const [openingBalances, purchaseOrders, manufacturingJobs, saleOrders, adjustments, webOrders] = await Promise.all([
            OpeningBalance.find({ sku: id, ...dateFilter }).lean(),
            PurchaseOrder.find({ "lineItems.sku": id, ...dateFilter }).populate('vendor', 'name').lean(),
            Manufacturing.find({ $or: [{ sku: id }, { "lineItems.sku": id }], ...dateFilter }).lean(),
            SaleOrder.find({ "lineItems.sku": id, ...dateFilter }).populate('clientId', 'name').lean(),
            AuditAdjustment.find({ sku: id, ...dateFilter }).lean(),
            WebOrder.find({
                $or: [{ "lineItems.sku": id }, { "lineItems.varianceId": { $in: varianceIds } }],
                status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending', 'on-hold', 'On Hold'] },
                ...dateFilter
            }).lean()
        ]);

        let transactions: any[] = [];
        const lotCosts = new Map<string, number>();

        // Process Opening Balances
        openingBalances.forEach((ob: any) => {
            if (ob.lotNumber && ob.cost) lotCosts.set(ob.lotNumber, ob.cost);
            transactions.push({
                _id: ob._id,
                date: new Date(ob.createdAt),
                type: 'Opening',
                reference: ob._id.toString(),
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
            po.lineItems?.forEach((line: any) => {
                if (line.sku?.toString() === id && line.qtyReceived > 0) {
                    if (line.lotNumber && (line.cost || line.price)) {
                        lotCosts.set(line.lotNumber, line.cost || line.price || 0);
                    }
                    transactions.push({
                        _id: line._id,
                        date: line.receivedDate ? new Date(line.receivedDate) : new Date(po.createdAt),
                        type: 'Purchase Order',
                        reference: po.label,
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

        // Optimize Manufacturing Ingredient Fetches
        const producedJobs = manufacturingJobs.filter((j: any) => j.sku?.toString() === id);
        const ingredientInfo: { sku: string, lotNumber: string }[] = [];
        producedJobs.forEach((job: any) => {
            job.lineItems?.forEach((li: any) => {
                const liSkuId = li.sku?._id || li.sku;
                if (liSkuId && li.lotNumber) ingredientInfo.push({ sku: liSkuId.toString(), lotNumber: li.lotNumber });
            });
        });

        const uniqueIngredients = Array.from(new Set(ingredientInfo.map(i => `${i.sku}:${i.lotNumber}`)))
            .map(key => { const [sku, lot] = key.split(':'); return { sku, lot }; });

        const [ingObs, ingPos] = await Promise.all([
            OpeningBalance.find({
                sku: { $in: uniqueIngredients.map(i => i.sku) },
                lotNumber: { $in: uniqueIngredients.map(i => i.lot) }
            }).select('sku lotNumber cost').lean(),
            PurchaseOrder.find({
                "lineItems": {
                    $elemMatch: {
                        sku: { $in: uniqueIngredients.map(i => i.sku) },
                        lotNumber: { $in: uniqueIngredients.map(i => i.lot) }
                    }
                }
            }).select('lineItems').lean()
        ]);

        const getIngredientCost = (skuId: string, lot: string) => {
            const ob = ingObs.find(o => o.sku.toString() === skuId && o.lotNumber === lot);
            if (ob) return ob.cost || 0;
            for (const po of ingPos) {
                const line = po.lineItems.find((l: any) => (l.sku?._id || l.sku)?.toString() === skuId && l.lotNumber === lot);
                if (line) return line.cost || 0;
            }
            return 0;
        };

        const durationToHours = (duration: string) => {
            const parts = (duration || '0:0:0').split(':');
            return parseInt(parts[0] || '0') + parseInt(parts[1] || '0') / 60 + parseInt(parts[2] || '0') / 3600;
        };

        // Process Manufacturing
        manufacturingJobs.forEach((job: any) => {
            if (job.sku?.toString() === id) {
                let totalMatCost = 0;
                job.lineItems?.forEach((li: any) => {
                    const liSkuId = (li.sku?._id || li.sku)?.toString();
                    if (!liSkuId) return;
                    const totalConsumed = ((li.recipeQty || 0) * (job.qty || 0)) + (li.qtyExtra || 0) + (li.qtyScrapped || 0);
                    totalMatCost += totalConsumed * getIngredientCost(liSkuId, li.lotNumber);
                });

                let totalLaborCost = 0;
                job.labor?.forEach((l: any) => { totalLaborCost += durationToHours(l.duration) * (l.hourlyRate || 0); });

                const totalQty = (job.qty || 0) + (job.qtyDifference || 0);
                const costPerUnit = totalQty > 0 ? (totalMatCost + totalLaborCost) / totalQty : 0;
                
                if (job.lotNumber || job.label) lotCosts.set(job.lotNumber || job.label, costPerUnit);

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

            // Ingredient Consumption
            job.lineItems?.forEach((line: any) => {
                if ((line.sku?._id || line.sku)?.toString() === id) {
                    const consumed = (line.recipeQty || 0) + (line.qtyExtra || 0);
                    if (consumed > 0) {
                        let cost = 0;
                        if (line.lotNumber) {
                            const matchingOb = openingBalances.find((ob: any) => ob.lotNumber === line.lotNumber);
                            if (matchingOb) {
                                cost = matchingOb.cost || 0;
                            } else {
                                for (const po of purchaseOrders) {
                                    const poLine = po.lineItems.find((l: any) => (l.sku?._id || l.sku)?.toString() === id && l.lotNumber === line.lotNumber);
                                    if (poLine) { cost = poLine.cost || 0; break; }
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
                }
            });
        });

        // Sale Orders
        saleOrders.forEach((so: any) => {
            so.lineItems?.forEach((line: any) => {
                if (line.sku?.toString() === id && line.qtyShipped > 0) {
                    let cost = line.cost || (line.lotNumber ? lotCosts.get(line.lotNumber) : 0) || 0;
                    transactions.push({
                        _id: line._id,
                        date: so.shippedDate ? new Date(so.shippedDate) : new Date(so.createdAt),
                        type: 'Orders',
                        reference: so.label, 
                        lotNumber: line.lotNumber || '',
                        quantity: -Math.abs(line.qtyShipped), 
                        uom: line.uom,
                        cost: cost,
                        salePrice: line.price || 0,
                        docId: so._id,
                        link: `/sales/wholesale-orders/${so._id}`
                    });
                }
            });
        });

        // Adjustments
        adjustments.forEach((adj: any) => {
            transactions.push({
                _id: adj._id,
                date: new Date(adj.createdAt),
                type: 'Audit',
                reference: '',
                lotNumber: adj.lotNumber || 'N/A',
                quantity: adj.qty,
                uom: sku.uom || 'Unit',
                cost: adj.cost || 0,
                docId: adj._id,
                link: `/warehouse/audit-adjustments`
            });
        });

        // Web Orders
        webOrders.forEach((wo: any) => {
             wo.lineItems?.forEach((line: any) => {
                  const lineSkuId = (line.sku?._id || line.sku)?.toString();
                  if (lineSkuId === id || (line.varianceId && varianceIds.includes(line.varianceId))) {
                       let cost = 0;
                       if (line.lotNumber) {
                           const matchingOb = openingBalances.find((ob: any) => ob.lotNumber === line.lotNumber);
                           if (matchingOb) cost = matchingOb.cost || 0;
                           else {
                               for (const po of purchaseOrders) {
                                   const poLine = po.lineItems.find((l: any) => (l.sku?._id || l.sku)?.toString() === id && l.lotNumber === line.lotNumber);
                                   if (poLine) { cost = poLine.cost || 0; break; }
                               }
                           }
                       }
                       transactions.push({
                           _id: line._id || `${wo._id}_${id}`,
                           date: new Date(wo.createdAt),
                           type: 'Web Order',
                           reference: line.varianceId ? `${wo._id} (${line.varianceId})` : wo._id,
                           lotNumber: line.lotNumber || 'N/A',
                           quantity: -Math.abs(line.qty || 0),
                           uom: 'Unit',
                           cost: cost,
                           salePrice: (line.total && line.qty) ? (line.total / line.qty) : 0,
                           docId: wo._id,
                           link: `/sales/web-orders/${wo._id}`,
                           varianceId: line.varianceId,
                           website: line.website
                       });
                  }
             });
        });

        // Final sorting and calculations (Optimized)
        transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        let balance = 0;
        let totalRevenue = 0;
        let costOfSales = 0;
        const monthlyStats = new Map<string, { revenue: number, qty: number }>();
        const curM = new Date(); curM.setDate(1);
        for(let i=0; i<12; i++) {
            const d = new Date(curM.getFullYear(), curM.getMonth()-i, 1);
            monthlyStats.set(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, { revenue:0, qty:0 });
        }

        const filteredTransactions = (startDate ? transactions.filter(t => t.date >= startDate) : transactions).map(t => {
            balance += t.quantity;
            if (t.type === 'Orders' || t.type === 'Web Order') {
                const qty = Math.abs(t.quantity);
                const rev = qty * (t.salePrice || 0);
                const cos = qty * (t.cost || 0);
                totalRevenue += rev; costOfSales += cos;
                const key = `${t.date.getFullYear()}-${String(t.date.getMonth()+1).padStart(2,'0')}`;
                if (monthlyStats.has(key)) {
                    const s = monthlyStats.get(key)!;
                    s.revenue += rev; s.qty += qty;
                }
            }
            return { ...t, balance };
        });

        const financials = {
            totalRevenue,
            costOfSales,
            grossProfit: totalRevenue - costOfSales,
            chartData: Array.from(monthlyStats.entries())
                .map(([date, stats]) => ({ date, revenue: stats.revenue, qty: stats.qty }))
                .sort((a,b) => a.date.localeCompare(b.date))
        };

        return NextResponse.json({
            sku,
            transactions: filteredTransactions.reverse(),
            financials,
            totalCount: filteredTransactions.length,
            debugStartDate: startDate,
            settings: { missingSkuImage: settings?.value || '' }
        });

    } catch (error: any) {
        console.error("Error fetching SKU ledger:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
