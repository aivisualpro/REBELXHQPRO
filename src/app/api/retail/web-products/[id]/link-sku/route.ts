import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import WebOrder from '@/models/WebOrder';
import { getAvailableLotsForSku } from '@/lib/lot-helpers';

export const dynamic = 'force-dynamic';

// Get available lots with positive balances for a SKU (FIFO order)
// Uses robust helper that includes ALL source AND consumption transactions
async function getAvailableLots(skuId: string) {
    return await getAvailableLotsForSku(skuId);
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

            const webOrders = await WebOrder.find(matchQuery).sort({ dateCompleted: 1, createdAt: 1 });
            let ordersUpdated = 0;

            // Import getSuggestedLotForDate for historical allocation
            const { getSuggestedLotForDate, getLotTransactions } = await import('@/lib/lot-helpers');
            
            // Get all lot transactions for this SKU to track running balances
            const allTransactions = await getLotTransactions(skuId);
            
            // Create a running lot balance tracker
            const lotBalances = new Map<string, { balance: number; cost: number; date: Date }>();
            
            // Process transactions to build initial state (excluding web orders we're about to update)
            const webOrderIdsToUpdate = new Set(webOrders.map((o: any) => o._id.toString()));
            
            for (const tx of allTransactions) {
                // Skip web order transactions that we're updating (avoid double counting)
                if (tx.source === 'Web Order') continue;
                
                const existing = lotBalances.get(tx.lotNumber);
                if (!existing && tx.qty <= 0) continue; // Don't create entries from consumption
                
                lotBalances.set(tx.lotNumber, {
                    balance: (existing?.balance || 0) + tx.qty,
                    cost: tx.cost > 0 ? tx.cost : (existing?.cost || 0),
                    date: existing?.date || tx.date
                });
            }
            
            // Helper to get available lots sorted by date (FIFO)
            const getAvailableLotsFIFO = () => {
                return Array.from(lotBalances.entries())
                    .filter(([_, data]) => data.balance > 0)
                    .map(([lotNumber, data]) => ({ lotNumber, balance: data.balance, cost: data.cost, date: data.date }))
                    .sort((a, b) => a.date.getTime() - b.date.getTime());
            };
            
            // Helper to allocate a lot and deduct from balance
            const allocateLot = (qtyNeeded: number): { lotNumber: string; cost: number } | null => {
                const availableLots = getAvailableLotsFIFO();
                
                for (const lot of availableLots) {
                    if (lot.balance >= qtyNeeded) {
                        // Deduct from this lot
                        const current = lotBalances.get(lot.lotNumber)!;
                        lotBalances.set(lot.lotNumber, {
                            ...current,
                            balance: current.balance - qtyNeeded
                        });
                        return { lotNumber: lot.lotNumber, cost: lot.cost };
                    }
                }
                
                // If no single lot has enough, use the first available lot (partial allocation)
                if (availableLots.length > 0) {
                    const lot = availableLots[0];
                    const current = lotBalances.get(lot.lotNumber)!;
                    lotBalances.set(lot.lotNumber, {
                        ...current,
                        balance: 0 // Deplete this lot
                    });
                    return { lotNumber: lot.lotNumber, cost: lot.cost };
                }
                
                return null;
            };

            // Process orders chronologically and allocate lots
            for (const order of webOrders) {
                let modified = false;
                order.lineItems.forEach((li: any) => {
                    const matchesProduct = li.productId === webProduct.webId;
                    const matchesVariation = variationId 
                        ? (li.variationId === variationId || li.variationId === Number(variationId))
                        : true;
                    
                    if (matchesProduct && matchesVariation) {
                        if (li.linkedSkuId !== skuId) {
                            li.linkedSkuId = skuId;
                            li.webProductId = webProduct._id;
                            
                            // Allocate lot based on FIFO at this point in time
                            const qtyNeeded = li.quantity || li.qty || 1;
                            const allocated = allocateLot(qtyNeeded);
                            
                            if (allocated) {
                                li.lotNumber = allocated.lotNumber;
                                li.cost = allocated.cost;
                            } else {
                                li.lotNumber = null;
                                li.cost = 0;
                            }
                            modified = true;
                        } 
                        else if (!li.lotNumber) {
                            const qtyNeeded = li.quantity || li.qty || 1;
                            const allocated = allocateLot(qtyNeeded);
                            
                            if (allocated) {
                                li.lotNumber = allocated.lotNumber;
                                li.cost = allocated.cost;
                                modified = true;
                            }
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

            // Clear linkedSkuId and lotNumber from all related web orders
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
                    const matchesVariation = variationId ? li.variationId === variationId : true;
                    
                    if (matchesProduct && matchesVariation) {
                        // Clear linkedSkuId, lotNumber and cost
                        li.linkedSkuId = null;
                        li.lotNumber = null;
                        li.cost = 0;
                        modified = true;
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
                message: 'SKU unlinked successfully',
                ordersUpdated
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
