/**
 * recompute-sku-stock.ts
 *
 * Computes the current stock balance for one or more SKUs using the exact same
 * logic as the ledger route, then saves it to Sku.currentStock.
 *
 * Call this after ANY transaction that affects inventory:
 *   - Manufacturing status → Fulfilled
 *   - Sale Order status → Shipped / Completed
 *   - Web Order status → completed
 *   - Audit Adjustment created / updated
 *   - Opening Balance created / updated
 *   - Purchase Order qtyReceived updated
 */

import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import SaleOrder from '@/models/SaleOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';
import WebOrder from '@/models/WebOrder';
import WebProduct from '@/models/WebProduct';
import { getGlobalStartDate } from '@/lib/global-settings';

/**
 * Compute the correct stock balance for a single SKU — mirrors the ledger route's logic.
 */
async function computeBalance(skuId: string): Promise<number> {
    await dbConnect();

    const startDate = await getGlobalStartDate();
    const df = startDate ? { createdAt: { $gte: startDate } } : {};
    const skuOid = mongoose.Types.ObjectId.isValid(skuId) ? new mongoose.Types.ObjectId(skuId) : skuId;
    const skuMatch = { $in: [skuOid, skuId] };

    // ── Fetch all sources in parallel ─────────────────────────────────────────
    const [obsAgg, posAgg, sosAgg, adjsAgg, mfgJobs, webProducts] = await Promise.all([
        // 1. Opening Balances
        OpeningBalance.aggregate([
            { $match: { sku: skuMatch, ...df } },
            { $group: { _id: null, qty: { $sum: '$qty' } } }
        ]),
        // 2. Purchase Orders — all qtyReceived regardless of status
        PurchaseOrder.aggregate([
            { $match: { ...df } },
            { $unwind: '$lineItems' },
            { $match: { 'lineItems.sku': skuMatch } },
            { $group: { _id: null, qty: { $sum: '$lineItems.qtyReceived' } } }
        ]),
        // 3. Sale Orders — Shipped/Completed/Pending Payment count toward stock reduction
        SaleOrder.aggregate([
            { $match: { orderStatus: { $in: ['Shipped', 'Completed', 'Pending Payment'] }, ...df } },
            { $unwind: '$lineItems' },
            { $match: { 'lineItems.sku': skuMatch } },
            { $group: { _id: null, qty: { $sum: {
                $cond: [
                    { $and: [{ $ne: ['$lineItems.qtyShipped', null] }, { $ne: ['$lineItems.qtyShipped', 0] }] },
                    '$lineItems.qtyShipped',
                    { $ifNull: ['$lineItems.qty', 0] }
                ]
            } } } }
        ]),
        // 4. Audit Adjustments
        AuditAdjustment.aggregate([
            { $match: { sku: skuMatch, ...df } },
            { $group: { _id: null, qty: { $sum: '$qty' } } }
        ]),
        // 5. Manufacturing — fetch relevant jobs (both production output and consumption input)
        Manufacturing.find({
            $or: [{ sku: skuMatch }, { 'lineItems.sku': skuMatch }],
            ...df
        } as any).select('sku qty qtyDifference status lineItems.sku lineItems.recipeQty lineItems.sa lineItems.qtyScrapped').lean(),
        // 6. WebProducts linked to this SKU — to find matching web orders
        WebProduct.find({
            $or: [
                { linkedSkuId: skuMatch },
                { 'linkedSkus.skuId': skuMatch },
                { 'variations.linkedSkuId': skuMatch },
                { 'variations.linkedSkus.skuId': skuMatch }
            ]
        }).select('webId website multiplier linkedSkuId linkedSkus variations').lean(),
    ]);

    let balance = 0;

    // 1. Opening Balances (IN)
    balance += obsAgg[0]?.qty || 0;

    // 2. Purchase Orders (IN)
    balance += posAgg[0]?.qty || 0;

    // 3. Sale Orders (OUT)
    balance -= sosAgg[0]?.qty || 0;

    // 4. Audit Adjustments (IN or OUT)
    balance += adjsAgg[0]?.qty || 0;

    // 5. Manufacturing
    (mfgJobs as any[]).forEach((mo: any) => {
        const st = (mo.status || '').toLowerCase();
        const outSkuId = (mo.sku?._id || mo.sku)?.toString();

        // Production (IN): this SKU is the output — exclude pending, processing, trash
        if (outSkuId === skuId && !['pending', 'processing', 'trash'].includes(st)) {
            balance += (mo.qty || 0) + (mo.qtyDifference || 0);
        }

        // Consumption (OUT): this SKU is an ingredient — fulfilled only
        if (st === 'fulfilled') {
            mo.lineItems?.forEach((li: any) => {
                if ((li.sku?._id || li.sku)?.toString() === skuId) {
                    const bom = (mo.qty || 0) * (li.recipeQty || 0);
                    const sa = (li.sa || 0) / 100;
                    balance -= bom + (li.qtyScrapped || 0) + (sa > 0 ? (bom / sa) - bom : 0);
                }
            });
        }
    });

    // 6. Web Orders — completed only, matched via WebProduct (same as ledger)
    if (webProducts.length > 0) {
        // Build web order match conditions from WebProduct links (website + webId)
        const wpMatchOr: any[] = [];
        (webProducts as any[]).forEach((wp: any) => {
            if (wp.webId && wp.website) {
                wpMatchOr.push({ website: wp.website, webId: wp.webId });
            }
        });

        if (wpMatchOr.length > 0) {
            const woAgg = await WebOrder.aggregate([
                { $match: { status: { $in: ['completed', 'Completed'] }, $or: wpMatchOr, ...df } },
                { $unwind: '$lineItems' }
            ]);

            // Build multiplier map from WebProducts
            const multiplierMap = new Map<string, number>();
            (webProducts as any[]).forEach((wp: any) => {
                const baseKey = `${wp.website}-${wp.webId}`;
                const baseLinked: any[] = wp.linkedSkus?.length > 0
                    ? wp.linkedSkus.filter((ls: any) => ls.skuId?.toString() === skuId)
                    : (wp.linkedSkuId?.toString() === skuId ? [{ multiplier: wp.multiplier || 1 }] : []);
                if (baseLinked.length > 0) multiplierMap.set(baseKey, baseLinked[0].multiplier || 1);

                (wp.variations || []).forEach((v: any) => {
                    const varLinked: any[] = v.linkedSkus?.length > 0
                        ? v.linkedSkus.filter((ls: any) => ls.skuId?.toString() === skuId)
                        : (v.linkedSkuId?.toString() === skuId ? [{ multiplier: v.multiplier || 1 }] : []);
                    if (varLinked.length > 0) {
                        const vid = String(v.id || v._id || '');
                        multiplierMap.set(`${baseKey}-${vid}`, varLinked[0].multiplier || 1);
                    }
                });
            });

            woAgg.forEach((line: any) => {
                const li = line.lineItems || line;
                const varId = String(li.variation_id || li.variationId || '');
                const wpKey = `${line.website}-${line.webId}`;
                const varKey = `${wpKey}-${varId}`;
                const multiplier = multiplierMap.get(varKey) ?? multiplierMap.get(wpKey) ?? 1;
                balance -= Math.abs(li.quantity || 0) * multiplier;
            });
        }
    }

    return Math.round(balance * 1e8) / 1e8; // round to 8 decimal places
}

/**
 * Recompute and save currentStock for one or more SKU IDs.
 * Fire-and-forget safe — errors are caught and logged.
 */
export async function recomputeSkuStock(...skuIds: string[]): Promise<void> {
    const unique = [...new Set(skuIds.filter(Boolean))];
    if (!unique.length) return;

    try {
        await dbConnect();
        await Promise.all(
            unique.map(async (skuId) => {
                const stock = await computeBalance(skuId);
                await Sku.findByIdAndUpdate(skuId, { currentStock: stock, updatedAt: new Date() });
                console.log(`[SKU STOCK] ${skuId} => ${stock}`);
            })
        );
    } catch (err) {
        console.error('[recomputeSkuStock] error:', err);
    }
}
