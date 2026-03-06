import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import WebOrder from '@/models/WebOrder';
import { getAvailableLotsForSku } from '@/lib/lot-helpers';

export const dynamic = 'force-dynamic';

// Get available lots with positive balances for a SKU (FIFO order)
async function getAvailableLots(skuId: string) {
    return await getAvailableLotsForSku(skuId);
}

// Helper: get the linkedSkus array from a product/variation, normalizing legacy fields
function getLinkedSkusFromDoc(doc: any): { skuId: string; multiplier: number }[] {
    if (doc.linkedSkus && doc.linkedSkus.length > 0) return doc.linkedSkus;
    if (doc.linkedSkuId) return [{ skuId: doc.linkedSkuId, multiplier: doc.multiplier || 1 }];
    return [];
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();
        const { action, skuId, variationId: rawVid, multiplier } = body;

        // Ensure variationId is a Number for strict matching if it looks like one
        const variationId = (rawVid && !isNaN(parseInt(rawVid.toString()))) ? parseInt(rawVid.toString()) : rawVid;

        const webProduct = await WebProduct.findById(id);
        if (!webProduct) {
            return NextResponse.json({ error: 'Web product not found' }, { status: 404 });
        }

        // Determine the target (product-level or specific variation)
        let variationIdx = -1;
        if (variationId) {
            variationIdx = webProduct.variations.findIndex(
                (v: any) => v.id === variationId || v._id === variationId.toString()
            );
            if (variationIdx === -1) {
                return NextResponse.json({ error: 'Variation not found' }, { status: 404 });
            }
        }

        const target = variationIdx >= 0 ? webProduct.variations[variationIdx] : webProduct;
        const pathPrefix = variationIdx >= 0 ? `variations.${variationIdx}` : '';

        // Helper to set a field on the target via webProduct.set() for reliable Mongoose tracking
        const setField = (field: string, value: any) => {
            if (pathPrefix) {
                webProduct.set(`${pathPrefix}.${field}`, value);
            } else {
                webProduct.set(field, value);
            }
        };

        // ─── ACTION: updateMultiplier ──────────────────────────────────────
        if (action === 'updateMultiplier') {
            const currentSkus = getLinkedSkusFromDoc(target);
            const updated = currentSkus.map(e =>
                e.skuId === skuId ? { ...e, multiplier: Math.max(1, multiplier || 1) } : e
            );
            setField('linkedSkus', updated);
            if (updated.length === 1) {
                setField('linkedSkuId', updated[0].skuId);
                setField('multiplier', updated[0].multiplier);
            }
            webProduct.updatedAt = new Date();
            await webProduct.save();
            return NextResponse.json({ success: true });
        }

        // ─── ACTION: add (link a new SKU) ──────────────────────────────────
        if (action === 'add' && skuId) {
            const currentSkus = getLinkedSkusFromDoc(target);
            if (currentSkus.some(e => e.skuId === skuId)) {
                return NextResponse.json({ success: true, ordersUpdated: 0, message: 'SKU already linked' });
            }
            const newEntry = { skuId, multiplier: Math.max(1, multiplier || 1) };
            const newLinkedSkus = [...currentSkus, newEntry];
            setField('linkedSkus', newLinkedSkus);
            setField('linkedSkuId', newLinkedSkus[0].skuId);
            setField('multiplier', newLinkedSkus[0].multiplier);

            webProduct.updatedAt = new Date();
            await webProduct.save();

            const ordersUpdated = await updateWebOrdersForSku(webProduct, variationId, skuId, 'link');

            return NextResponse.json({
                success: true,
                linkedSkus: newLinkedSkus,
                ordersUpdated
            });
        }

        // ─── ACTION: remove (unlink a SKU) ─────────────────────────────────
        if (action === 'remove' && skuId) {
            const currentSkus = getLinkedSkusFromDoc(target);
            const newLinkedSkus = currentSkus.filter(e => e.skuId !== skuId);
            setField('linkedSkus', newLinkedSkus);
            if (newLinkedSkus.length > 0) {
                setField('linkedSkuId', newLinkedSkus[0].skuId);
                setField('multiplier', newLinkedSkus[0].multiplier);
            } else {
                setField('linkedSkuId', null);
                setField('multiplier', 1);
            }

            webProduct.updatedAt = new Date();
            await webProduct.save();

            const ordersUpdated = await updateWebOrdersForSku(webProduct, variationId, skuId, 'unlink');

            return NextResponse.json({
                success: true,
                linkedSkus: newLinkedSkus,
                ordersUpdated
            });
        }

        // ─── LEGACY: old-style link/unlink (backward compat) ───────────────
        if (skuId) {
            const currentSkus = getLinkedSkusFromDoc(target);
            if (!currentSkus.some(e => e.skuId === skuId)) {
                setField('linkedSkus', [...currentSkus, { skuId, multiplier: 1 }]);
            }
            setField('linkedSkuId', skuId);
            setField('multiplier', 1);
            webProduct.updatedAt = new Date();
            await webProduct.save();

            const ordersUpdated = await updateWebOrdersForSku(webProduct, variationId, skuId, 'link');
            return NextResponse.json({ success: true, linkedSkuId: skuId, ordersUpdated });
        } else {
            setField('linkedSkus', []);
            setField('linkedSkuId', null);
            setField('multiplier', 1);
            webProduct.updatedAt = new Date();
            await webProduct.save();

            const ordersUpdated = await clearAllLinkedSkusFromOrders(webProduct, variationId);
            return NextResponse.json({ success: true, message: 'SKU unlinked', ordersUpdated });
        }

    } catch (error: any) {
        console.error('Link SKU error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─── Helper: update web orders when linking/unlinking a specific SKU ─────────

async function updateWebOrdersForSku(
    webProduct: any,
    variationId: any,
    skuId: string,
    mode: 'link' | 'unlink'
) {
    const matchQuery: any = {
        'lineItems.productId': webProduct.webId,
        website: webProduct.website
    };
    if (variationId) {
        matchQuery['lineItems.variationId'] = variationId;
    }

    const webOrders = await WebOrder.find(matchQuery).sort({ dateCompleted: 1, createdAt: 1 });
    let ordersUpdated = 0;

    // Get the CURRENT full set of linked SKUs from the WebProduct/variation
    let target = webProduct;
    if (variationId && webProduct.variations) {
        const v = webProduct.variations.find(
            (v: any) => v.id == variationId || v._id == variationId
        );
        if (v) target = v;
    }
    const wpLinkedSkus = getLinkedSkusFromDoc(target);

    if (mode === 'link') {
        // No auto lot allocation — lots must be selected manually from order detail page

        for (const order of webOrders) {
            let modified = false;
            for (let i = 0; i < order.lineItems.length; i++) {
                const li = order.lineItems[i];
                const matchesProduct = li.productId === webProduct.webId;
                const matchesVariation = variationId
                    ? (li.variationId === variationId || li.variationId === Number(variationId))
                    : true;

                if (matchesProduct && matchesVariation) {
                    // Sync the full linkedSkus array from WebProduct to order line item
                    const currentLinkedSkus = li.linkedSkus || [];
                    const newLinkedSkus = wpLinkedSkus.map((wpSku: any) => {
                        // Keep existing lot/cost if this SKU was already linked
                        const existing = currentLinkedSkus.find((e: any) => e.skuId === wpSku.skuId);
                        if (existing) return existing;
                        // New SKU: no auto lot allocation, user selects manually
                        return { skuId: wpSku.skuId, multiplier: wpSku.multiplier || 1, lotNumber: null, cost: 0 };
                    });

                    order.set(`lineItems.${i}.linkedSkus`, newLinkedSkus);
                    order.set(`lineItems.${i}.webProductId`, webProduct._id.toString());

                    // Keep legacy fields in sync with first entry
                    if (newLinkedSkus.length > 0) {
                        order.set(`lineItems.${i}.linkedSkuId`, newLinkedSkus[0].skuId);
                        order.set(`lineItems.${i}.lotNumber`, newLinkedSkus[0].lotNumber);
                        order.set(`lineItems.${i}.cost`, newLinkedSkus[0].cost);
                    }
                    modified = true;
                }
            }
            if (modified) {
                order.updatedAt = new Date();
                await order.save();
                ordersUpdated++;
            }
        }
    } else {
        // Unlink mode: remove the specific SKU from linkedSkus array
        for (const order of webOrders) {
            let modified = false;
            for (let i = 0; i < order.lineItems.length; i++) {
                const li = order.lineItems[i];
                const matchesProduct = li.productId === webProduct.webId;
                const matchesVariation = variationId
                    ? (li.variationId === variationId || li.variationId === Number(variationId))
                    : true;

                if (matchesProduct && matchesVariation) {
                    const currentLinkedSkus = li.linkedSkus || [];
                    const newLinkedSkus = currentLinkedSkus.filter((e: any) => e.skuId !== skuId);
                    order.set(`lineItems.${i}.linkedSkus`, newLinkedSkus);

                    // Update legacy fields
                    if (newLinkedSkus.length > 0) {
                        order.set(`lineItems.${i}.linkedSkuId`, newLinkedSkus[0].skuId);
                        order.set(`lineItems.${i}.lotNumber`, newLinkedSkus[0].lotNumber);
                        order.set(`lineItems.${i}.cost`, newLinkedSkus[0].cost);
                    } else {
                        order.set(`lineItems.${i}.linkedSkuId`, null);
                        order.set(`lineItems.${i}.lotNumber`, null);
                        order.set(`lineItems.${i}.cost`, 0);
                    }
                    modified = true;
                }
            }
            if (modified) {
                order.updatedAt = new Date();
                await order.save();
                ordersUpdated++;
            }
        }
    }

    return ordersUpdated;
}

async function clearAllLinkedSkusFromOrders(webProduct: any, variationId: any) {
    const matchQuery: any = {
        'lineItems.productId': webProduct.webId,
        website: webProduct.website
    };
    if (variationId) {
        matchQuery['lineItems.variationId'] = variationId;
    }

    const webOrders = await WebOrder.find(matchQuery);
    let ordersUpdated = 0;

    for (const order of webOrders) {
        let modified = false;
        for (let i = 0; i < order.lineItems.length; i++) {
            const li = order.lineItems[i];
            const matchesProduct = li.productId === webProduct.webId;
            const matchesVariation = variationId ? li.variationId === variationId : true;
            if (matchesProduct && matchesVariation) {
                order.set(`lineItems.${i}.linkedSkus`, []);
                order.set(`lineItems.${i}.linkedSkuId`, null);
                order.set(`lineItems.${i}.lotNumber`, null);
                order.set(`lineItems.${i}.cost`, 0);
                modified = true;
            }
        }
        if (modified) {
            order.updatedAt = new Date();
            await order.save();
            ordersUpdated++;
        }
    }
    return ordersUpdated;
}

// GET available lots for a web product's linked SKU
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);
        const variationId = searchParams.get('variationId');

        const webProduct = await WebProduct.findById(id).lean();
        if (!webProduct) {
            return NextResponse.json({ error: 'Web product not found' }, { status: 404 });
        }

        let target: any = webProduct;
        if (variationId) {
            const variation = (webProduct as any).variations?.find(
                (v: any) => v.id === parseInt(variationId) || v._id === variationId
            );
            target = variation || webProduct;
        }

        const linkedSkus = getLinkedSkusFromDoc(target);
        if (linkedSkus.length === 0) {
            return NextResponse.json({
                linkedSkus: [],
                availableLots: [],
                message: 'No SKU linked yet'
            });
        }

        // Return lots for all linked SKUs
        const allLots: any[] = [];
        for (const entry of linkedSkus) {
            const lots = await getAvailableLots(entry.skuId);
            allLots.push({ skuId: entry.skuId, multiplier: entry.multiplier, lots });
        }

        return NextResponse.json({
            linkedSkus,
            availableLots: allLots
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
