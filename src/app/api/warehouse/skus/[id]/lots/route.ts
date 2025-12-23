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

        const [
            openingBalances,
            purchaseOrders,
            manufacturingJobs,
            saleOrders,
            adjustments,
            webOrders
        ] = await Promise.all([
            OpeningBalance.find({ sku: id, ...dateFilter }).lean(),
            PurchaseOrder.find({ "lineItems.sku": id, ...dateFilter }).lean(),
            Manufacturing.find({
                $or: [{ sku: id }, { "lineItems.sku": id }],
                ...dateFilter
            }).lean(),
            SaleOrder.find({ "lineItems.sku": id, ...dateFilter }).lean(),
            AuditAdjustment.find({ sku: id, ...dateFilter }).lean(),
            WebOrder.find({
                 "lineItems.sku": id,
                 status: { $in: ['completed', 'shipped', 'Completed', 'Shipped'] }, 
                 ...dateFilter
            }).lean()
        ]);

        const lotBalances = new Map<string, number>();
        const lotMetadata = new Map<string, { source: string, date: string }>();

        const registerLot = (lot: string, qty: number, source?: string, date?: string | Date, isSource: boolean = false) => {
            const normLot = lot ? lot.trim() : 'N/A';
            if (normLot === 'N/A') return;

            const current = lotBalances.get(normLot) || 0;
            lotBalances.set(normLot, current + qty);

            // Capture source metadata if it's a source transaction and we haven't set it yet
            if (isSource && source && date && !lotMetadata.has(normLot)) {
                lotMetadata.set(normLot, { source, date: new Date(date).toISOString() });
            }
        };

        // Process Opening Balances
        openingBalances.forEach((ob: any) => {
            registerLot(ob.lotNumber, ob.qty || 0, 'Opening Balance', ob.createdAt, true);
        });

        // Process Purchase Orders
        purchaseOrders.forEach((po: any) => {
            const lines = po.lineItems.filter((line: any) => line.sku?.toString() === id);
            lines.forEach((line: any) => {
                if (line.qtyReceived > 0) {
                     const date = po.receivedDate || po.createdAt;
                     registerLot(line.lotNumber, line.qtyReceived, `PO #${po.label || po._id}`, date, true);
                }
            });
        });

        // Process Manufacturing
        manufacturingJobs.forEach((job: any) => {
            if (job.sku?.toString() === id) {
                registerLot(job.lotNumber || job.label, job.qty || 0, `Manufacturing`, job.createdAt, true);
            }
            if (job.lineItems && Array.isArray(job.lineItems)) {
                const ingredients = job.lineItems.filter((line: any) => line.sku?.toString() === id);
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
             registerLot(adj.lotNumber, adj.qty, 'Audit Adjustment', adj.createdAt, isAdd);
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
                    date: meta?.date || null
                };
            })
            .filter(l => l.balance > 0)
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
