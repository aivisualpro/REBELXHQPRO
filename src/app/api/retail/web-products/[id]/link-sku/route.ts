import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import WebOrder from '@/models/WebOrder';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';

export const dynamic = 'force-dynamic';

// Get available lots with positive balances for a SKU (FIFO order)
async function getAvailableLots(skuId: string) {
    const lotBalances = new Map<string, { balance: number; cost: number; source: string; date: Date }>();

    // Opening Balances
    const obs = await OpeningBalance.find({ sku: skuId }).lean();
    obs.forEach((ob: any) => {
        if (ob.lotNumber) {
            const existing = lotBalances.get(ob.lotNumber);
            lotBalances.set(ob.lotNumber, {
                balance: (existing?.balance || 0) + (ob.qty || 0),
                cost: ob.cost || existing?.cost || 0,
                source: 'Opening Balance',
                date: existing?.date || ob.createdAt
            });
        }
    });

    // Purchase Orders (Received)
    const pos = await PurchaseOrder.find({ 'lineItems.sku': skuId, status: 'Received' }).lean();
    pos.forEach((po: any) => {
        po.lineItems?.forEach((li: any) => {
            if (li.sku?.toString() === skuId && li.lotNumber && li.qtyReceived > 0) {
                const existing = lotBalances.get(li.lotNumber);
                lotBalances.set(li.lotNumber, {
                    balance: (existing?.balance || 0) + (li.qtyReceived || 0),
                    cost: li.cost || existing?.cost || 0,
                    source: 'Purchase Order',
                    date: existing?.date || li.receivedDate || po.createdAt
                });
            }
        });
    });

    // Manufacturing (Produced)
    const mos = await Manufacturing.find({ sku: skuId, status: 'Completed' }).lean();
    mos.forEach((mo: any) => {
        const lot = mo.lotNumber || mo.label;
        if (lot) {
            const existing = lotBalances.get(lot);
            lotBalances.set(lot, {
                balance: (existing?.balance || 0) + (mo.qty || 0),
                cost: existing?.cost || 0, // COGM calculated elsewhere
                source: 'Manufacturing',
                date: existing?.date || mo.scheduledFinish || mo.createdAt
            });
        }
    });

    // Audit Adjustments
    const adjs = await AuditAdjustment.find({ sku: skuId }).lean();
    adjs.forEach((adj: any) => {
        if (adj.lotNumber) {
            const existing = lotBalances.get(adj.lotNumber);
            lotBalances.set(adj.lotNumber, {
                balance: (existing?.balance || 0) + (adj.qty || 0),
                cost: adj.cost || existing?.cost || 0,
                source: existing?.source || 'Audit',
                date: existing?.date || adj.createdAt
            });
        }
    });

    // Convert to array, filter positive balances, sort by date (FIFO)
    return Array.from(lotBalances.entries())
        .filter(([_, data]) => data.balance > 0)
        .map(([lotNumber, data]) => ({ lotNumber, ...data }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();
        const { skuId, variationId: rawVid } = body;
        
        // Ensure variationId is a Number for strict matching if it looks like one
        const variationId = (rawVid && !isNaN(parseInt(rawVid.toString()))) ? parseInt(rawVid.toString()) : rawVid;

        // Find the web product
        const webProduct = await WebProduct.findById(id);
        if (!webProduct) {
            return NextResponse.json({ error: 'Web product not found' }, { status: 404 });
        }

        // If skuId is provided (Linking)
        if (skuId) {
            // Get available lots for FIFO suggestion
            const availableLots = await getAvailableLots(skuId);
            const suggestedLot = availableLots[0] || null;

            // Update the linkedSkuId on product or variation
            if (variationId) {
                // Link to specific variation
                const variationIndex = webProduct.variations.findIndex(
                    (v: any) => v.id === variationId || v._id === variationId.toString()
                );
                if (variationIndex === -1) {
                    return NextResponse.json({ error: 'Variation not found' }, { status: 404 });
                }
                webProduct.variations[variationIndex].linkedSkuId = skuId;
            } else {
                // Link to product (simple product)
                webProduct.linkedSkuId = skuId;
            }

            webProduct.updatedAt = new Date();
            await webProduct.save();

            // Find and update all matching web order line items
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
                order.lineItems.forEach((li: any) => {
                    const matchesProduct = li.productId === webProduct.webId;
                    const matchesVariation = variationId ? li.variationId === variationId : !li.variationId;
                    
                    if (matchesProduct && matchesVariation) {
                        // If SKU is different, update link and force a new suggested lot (old lot is invalid for new SKU)
                        if (li.linkedSkuId !== skuId) {
                            li.linkedSkuId = skuId;
                            li.webProductId = webProduct._id;
                            
                            if (suggestedLot) {
                                li.lotNumber = suggestedLot.lotNumber;
                                li.cost = suggestedLot.cost;
                            } else {
                                li.lotNumber = null;
                                li.cost = 0;
                            }
                            modified = true;
                        } 
                        // If same SKU but lot is missing, fill it with suggestion
                        else if (!li.lotNumber && suggestedLot) {
                            li.lotNumber = suggestedLot.lotNumber;
                            li.cost = suggestedLot.cost;
                            modified = true;
                        }
                    }
                });
                
                if (modified) {
                    order.updatedAt = new Date();
                    await order.save();
                    ordersUpdated++;
                }
            }

            return NextResponse.json({
                success: true,
                linkedSkuId: skuId,
                variationId: variationId || null,
                suggestedLot,
                availableLots,
                ordersUpdated
            });
        } 
        
        // If skuId is empty (Unlinking)
        else {
            if (variationId) {
                const variationIndex = webProduct.variations.findIndex(
                    (v: any) => v.id === variationId || v._id === variationId.toString()
                );
                if (variationIndex !== -1) {
                    webProduct.variations[variationIndex].linkedSkuId = null;
                }
            } else {
                webProduct.linkedSkuId = null;
            }
            
            webProduct.updatedAt = new Date();
            await webProduct.save();

            // Optionally, we could choose to remove the link from historical orders too, 
            // but generally we want to keep historical data intact. 
            // So we will just unlink the product definition.

            return NextResponse.json({
                success: true,
                message: 'SKU unlinked successfully'
            });
        }

    } catch (error: any) {
        console.error('Link SKU error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
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

        let linkedSkuId: string | null = null;
        
        if (variationId) {
            const variation = (webProduct as any).variations?.find(
                (v: any) => v.id === parseInt(variationId) || v._id === variationId
            );
            linkedSkuId = variation?.linkedSkuId || null;
        } else {
            linkedSkuId = (webProduct as any).linkedSkuId || null;
        }

        if (!linkedSkuId) {
            return NextResponse.json({ 
                linkedSkuId: null, 
                availableLots: [],
                message: 'No SKU linked yet'
            });
        }

        const availableLots = await getAvailableLots(linkedSkuId);

        return NextResponse.json({
            linkedSkuId,
            availableLots
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
