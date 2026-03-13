import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import WebProduct from '@/models/WebProduct';
import Sku from '@/models/Sku';
import { getLotsWithCost } from '@/lib/lot-cost';

export const dynamic = 'force-dynamic';

// ⚡ In-memory cache for web order detail responses (30s TTL)
const CACHE_TTL = 30_000;
const orderDetailCache = new Map<string, { data: any; timestamp: number }>();

// Helper: get linked SKUs array, normalizing legacy single-link format
function getLinkedSkusFromDoc(doc: any): { skuId: string; multiplier: number }[] {
    if (doc.linkedSkus && doc.linkedSkus.length > 0) return doc.linkedSkus;
    if (doc.linkedSkuId) return [{ skuId: doc.linkedSkuId, multiplier: doc.multiplier || 1 }];
    return [];
}

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const { id } = params;

        // ⚡ Check in-memory cache first
        const bustCache = new URL(request.url).searchParams.get('bust') === '1';
        const cached = orderDetailCache.get(id);
        if (!bustCache && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            return NextResponse.json(cached.data);
        }

        await dbConnect();
        // Ensure models are registered
        void Sku;

        // Exclude heavy unused fields (Meta Data, Coupons, Refunds tabs removed)
        const order = await WebOrder.findById(id)
            .select('-metaData -couponLines -refunds -feeLines -taxLines')
            .lean() as any;

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // ─── 1. Resolve WebProduct linked SKUs for each line item ─────────
        // Build a map of webProductId -> WebProduct so we can get linkedSkus
        const webProductIds = [...new Set(
            order.lineItems
                .map((item: any) => item.webProductId || item.parentProductId)
                .filter(Boolean)
        )];

        // Collect productIds for items without webProductId
        const unmatchedProductIds = [...new Set(
            order.lineItems
                .filter((item: any) => !item.webProductId && !item.parentProductId && item.productId)
                .map((item: any) => item.productId)
        )];

        // ⚡ Fire BOTH WebProduct queries in parallel
        const wpSelect = 'variations multiplier linkedSkuId linkedSkus webId';
        const [webProductsById, webProductsByWebId] = await Promise.all([
            webProductIds.length > 0
                ? WebProduct.find({ _id: { $in: webProductIds } }).select(wpSelect).lean()
                : Promise.resolve([]),
            unmatchedProductIds.length > 0
                ? WebProduct.find({ webId: { $in: unmatchedProductIds }, website: order.website }).select(wpSelect).lean()
                : Promise.resolve([]),
        ]);

        const productWpMap = new Map<string, any>();
        const productIdToWpMap = new Map<number, any>();
        (webProductsById as any[]).forEach((wp: any) => productWpMap.set(wp._id.toString(), wp));
        (webProductsByWebId as any[]).forEach((wp: any) => {
            productIdToWpMap.set(wp.webId, wp);
            productWpMap.set(wp._id.toString(), wp);
        });

        // ─── 2. Enrich each line item with linked SKUs from WebProduct ────
        const multiplierMap = new Map<string, number>();

        order.lineItems = order.lineItems.map((item: any) => {
            const enriched = { ...item };
            // Resolve the WebProduct
            const wpId = item.webProductId || item.parentProductId;
            const wp = wpId ? productWpMap.get(wpId.toString()) : productIdToWpMap.get(item.productId);

            if (wp) {
                enriched.webProductId = enriched.webProductId || wp._id.toString();

                // Get the correct target (product or variation)
                let target = wp;
                let prodMultiplier = wp.multiplier ?? 1;
                if (item.variationId && wp.variations) {
                    const variation = wp.variations.find(
                        (v: any) => v.id == item.variationId || v._id == item.variationId
                    );
                    if (variation) {
                        target = variation;
                        if (variation.name) enriched.variationName = variation.name;
                        if (variation.multiplier != null) prodMultiplier = variation.multiplier;
                    }
                }

                // If no variationId but product has variations, attach them for selection
                if (!item.variationId && wp.variations && wp.variations.length > 0) {
                    enriched.availableVariations = wp.variations.map((v: any) => ({
                        id: v.id,
                        _id: v._id,
                        name: v.name || `Variation ${v.id}`,
                        sku: v.sku || '',
                        price: v.price,
                        attributes: v.attributes || [],
                    }));
                }

                multiplierMap.set(String(item.id), prodMultiplier);

                // Get ALL linked SKUs from the WebProduct target
                const wpLinkedSkus = getLinkedSkusFromDoc(target);

                // If the line item doesn't already have linkedSkus populated, populate from WebProduct
                if ((!enriched.linkedSkus || enriched.linkedSkus.length === 0) && wpLinkedSkus.length > 0) {
                    // Migrate: use the existing linkedSkuId/lotNumber/cost for the first match
                    enriched.linkedSkus = wpLinkedSkus.map((ls: any) => {
                        if (ls.skuId === enriched.linkedSkuId) {
                            return {
                                skuId: ls.skuId,
                                multiplier: ls.multiplier || 1,
                                lotNumber: enriched.lotNumber || null,
                                cost: enriched.cost || 0,
                            };
                        }
                        return {
                            skuId: ls.skuId,
                            multiplier: ls.multiplier || 1,
                            lotNumber: null,
                            cost: 0,
                        };
                    });
                    enriched._enrichedLinkedSkus = true; // Flag for background persist
                }
            }

            return enriched;
        });

        // ─── 3. Batch SKU name lookup ─────────────────────────────────────
        const allSkuIds = [...new Set(
            order.lineItems.flatMap((item: any) => {
                const ids: string[] = [];
                if (item.linkedSkuId) ids.push(item.linkedSkuId);
                if (item.linkedSkus) {
                    item.linkedSkus.forEach((ls: any) => {
                        if (ls.skuId) ids.push(ls.skuId);
                    });
                }
                if (typeof item.sku === 'string' && item.sku.length > 0) ids.push(item.sku);
                return ids;
            })
        )];

        const skuNameMap = new Map<string, string>();
        if (allSkuIds.length > 0) {
            const skus = await Sku.find({ _id: { $in: allSkuIds } }).select('name uom').lean();
            skus.forEach((s: any) => {
                skuNameMap.set(s._id.toString(), s.name || s._id.toString());
            });
        }

        // Apply SKU names
        order.lineItems = order.lineItems.map((item: any) => {
            const enriched = { ...item };
            if (item.linkedSkuId && skuNameMap.has(item.linkedSkuId)) {
                enriched.linkedSkuName = skuNameMap.get(item.linkedSkuId);
            }
            if (enriched.linkedSkus) {
                enriched.linkedSkus = enriched.linkedSkus.map((ls: any) => ({
                    ...ls,
                    skuName: skuNameMap.get(ls.skuId) || ls.skuId,
                }));
            }
            if (typeof item.sku === 'string' && skuNameMap.has(item.sku)) {
                enriched.skuDetails = { name: skuNameMap.get(item.sku) };
            }
            return enriched;
        });

        // ─── 4. VIRTUAL COST CALCULATION ──────────────────────────────────
        // Collect unique SKU IDs that need cost lookup (from linkedSkus array)
        const skuIdsForCost = [...new Set(
            order.lineItems.flatMap((item: any) => {
                const ids: string[] = [];
                // From new linkedSkus array
                if (item.linkedSkus) {
                    item.linkedSkus
                        .filter((ls: any) => ls.skuId && ls.lotNumber)
                        .forEach((ls: any) => ids.push(ls.skuId));
                }
                // Legacy: single linkedSkuId with lotNumber
                if (item.linkedSkuId && item.lotNumber && !item.linkedSkus?.length) {
                    ids.push(item.linkedSkuId);
                }
                return ids;
            })
        )] as string[];

        const lotCostBySkuId = new Map<string, Map<string, number>>();
        if (skuIdsForCost.length > 0) {
            const costResults = await Promise.all(
                skuIdsForCost.map(sid => getLotsWithCost(sid))
            );
            skuIdsForCost.forEach((sid, idx) => {
                lotCostBySkuId.set(sid, costResults[idx]);
            });
        }

        // Apply virtual costs
        order.lineItems = order.lineItems.map((item: any) => {
            const enriched = { ...item };
            if (enriched.linkedSkus && enriched.linkedSkus.length > 0) {
                enriched.linkedSkus = enriched.linkedSkus.map((ls: any) => {
                    if (ls.skuId && ls.lotNumber) {
                        const skuLots = lotCostBySkuId.get(ls.skuId);
                        const baseCost = skuLots?.get(ls.lotNumber) || 0;
                        return { ...ls, cost: baseCost * (ls.multiplier || 1) };
                    }
                    return ls;
                });
            } else if (enriched.linkedSkuId && enriched.lotNumber) {
                // Legacy single-link cost
                const skuLots = lotCostBySkuId.get(enriched.linkedSkuId);
                const baseCost = skuLots?.get(enriched.lotNumber) || 0;
                const multiplier = multiplierMap.get(String(enriched.id)) || 1;
                enriched.cost = baseCost * multiplier;
            }
            return enriched;
        });

        // ─── 5. Persist newly-enriched linkedSkus to DB (background, fire-and-forget) ──
        // If any line item got linkedSkus from WebProduct enrichment but didn't have them stored,
        // persist them so future PATCH calls can find them.
        const bulkOps: any[] = [];
        order.lineItems.forEach((item: any, idx: number) => {
            if (item.linkedSkus && item.linkedSkus.length > 0 && item._enrichedLinkedSkus) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: id, [`lineItems.${idx}.id`]: item.id },
                        update: {
                            $set: {
                                [`lineItems.${idx}.linkedSkus`]: item.linkedSkus.map((ls: any) => ({
                                    skuId: ls.skuId,
                                    multiplier: ls.multiplier || 1,
                                    lotNumber: ls.lotNumber || null,
                                    cost: ls.cost || 0,
                                })),
                            }
                        }
                    }
                });
            }
        });
        if (bulkOps.length > 0) {
            // Fire-and-forget: don't await to keep response fast
            WebOrder.bulkWrite(bulkOps).catch((e: any) => console.error('Background linkedSkus persist error:', e));
        }

        // ⚡ Cache the response
        orderDetailCache.set(id, { data: order, timestamp: Date.now() });

        return NextResponse.json(order);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const params = await props.params;
        const { id } = params;
        const body = await request.json();

        const updatedOrder = await WebOrder.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true }
        ).lean();

        if (!updatedOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // ⚡ Invalidate cache on mutation
        orderDetailCache.delete(id);

        return NextResponse.json(updatedOrder);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
