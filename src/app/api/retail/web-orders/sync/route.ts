import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';
import WebProduct from '@/models/WebProduct';
import Sku from '@/models/Sku';
import SyncMeta from '@/models/SyncMeta';
import { getAvailableLotsForSkus, LotBalance } from '@/lib/inventory/lots';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 500; // Process orders in batches

let syncProgress = {
    isSyncing: false,
    currentStep: '',
    progress: 0,
    total: 0,
    logs: [] as string[],
    startTime: null as number | null,
    currentOrderNumber: '',
    currentOrderDate: '',
    currentOrderTotal: 0,
    currentOrderCustomer: '',
    currentSite: '',
    fetchingPhase: false,
    fetchingPage: 0,
    fetchingFound: 0,
    fetchingSite: '',
    isFullSync: false,
    stats: { added: 0, updated: 0, skipped: 0 }
};

interface WebProductMapItem {
    _id: string;
    linkedSkuId?: string;
    variations?: any[];
    image?: string;
}

async function fetchOrdersFromWC(
    baseUrl: string, 
    key: string, 
    secret: string, 
    siteName: string,
    modifiedAfter?: Date
) {
    let allOrders: any[] = [];
    let page = 1;
    let hasMore = true;

    const apiBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');

    syncProgress.fetchingPhase = true;
    syncProgress.fetchingSite = siteName;
    syncProgress.fetchingPage = 0;
    syncProgress.fetchingFound = 0;

    while (hasMore) {
        try {
            syncProgress.fetchingPage = page;
            syncProgress.currentStep = `Fetching orders page ${page} from ${siteName}...`;

            let url = `${apiBase}orders?per_page=100&page=${page}`;
            if (modifiedAfter) {
                url += `&modified_after=${modifiedAfter.toISOString()}`;
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Basic ${auth}` },
                cache: 'no-store'
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`WooCommerce Orders API Error (${res.status}): ${errText}`);
            }

            const data = await res.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                hasMore = false;
            } else {
                allOrders = allOrders.concat(data);
                syncProgress.fetchingFound = allOrders.length;
                page++;
                if (data.length < 100) hasMore = false;
            }
        } catch (error: any) {
            console.error(`Error fetching orders page ${page} from ${baseUrl}:`, error.message);
            hasMore = false;
            throw error;
        }
    }
    
    syncProgress.fetchingPhase = false;
    return allOrders;
}

// Transform WC order to MongoDB document
function transformOrder(
    order: any, 
    site: any, 
    webProductMap: Map<string, WebProductMapItem>,
    lotMap: Map<string, LotBalance[]>
) {
    const orderId = `WC-${site.name}-${order.id}`;
    
    const lineItems = (order.line_items || []).map((item: any) => {
        const wpKey = `${item.product_id}-${site.name}`;
        const webProduct = webProductMap.get(wpKey);
        
        // Determine Linked SKU
        let linkedSkuId = null;
        if (webProduct) {
            if (item.variation_id) {
                const variant = webProduct.variations?.find((v: any) => v.id === item.variation_id);
                linkedSkuId = variant?.linkedSkuId || webProduct.linkedSkuId;
            } else {
                linkedSkuId = webProduct.linkedSkuId;
            }
        }

        // Determine Lot # and Cost
        let lotNumber = null;
        let cost = null;

        if (linkedSkuId && lotMap.has(linkedSkuId)) {
            const availableLots = lotMap.get(linkedSkuId) || [];
            if (availableLots.length > 0) {
                // Auto-assign oldest available lot (FIFO)
                lotNumber = availableLots[0].lotNumber;
                cost = availableLots[0].cost;
            }
        }

        return {
            id: item.id,
            name: item.name,
            productId: item.product_id, // WooCommerce Product ID (webId)
            variationId: item.variation_id,
            webProductId: webProduct?._id || null, // Internal WebProduct ID
            linkedSkuId: linkedSkuId || null,
            lotNumber: lotNumber,
            cost: cost,
            quantity: item.quantity,
            taxClass: item.tax_class,
            subtotal: parseFloat(item.subtotal) || 0,
            subtotalTax: parseFloat(item.subtotal_tax) || 0,
            total: parseFloat(item.total) || 0,
            totalTax: parseFloat(item.total_tax) || 0,
            taxes: item.taxes,
            metaData: item.meta_data,
            sku: item.sku,
            price: item.price,
            image: webProduct?.image || '',
            parentProductId: webProduct?._id || null
        };
    });

    return {
        _id: orderId,
        webId: order.id,
        parentId: order.parent_id,
        number: order.number,
        orderKey: order.order_key,
        createdVia: order.created_via,
        version: order.version,
        status: order.status,
        currency: order.currency,
        dateCreated: order.date_created ? new Date(order.date_created) : null,
        dateModified: order.date_modified ? new Date(order.date_modified) : null,
        discountTotal: parseFloat(order.discount_total) || 0,
        discountTax: parseFloat(order.discount_tax) || 0,
        shippingTotal: parseFloat(order.shipping_total) || 0,
        shippingTax: parseFloat(order.shipping_tax) || 0,
        cartTax: parseFloat(order.cart_tax) || 0,
        total: parseFloat(order.total) || 0,
        totalTax: parseFloat(order.total_tax) || 0,
        pricesIncludeTax: order.prices_include_tax,
        customerId: order.customer_id,
        customerIpAddress: order.customer_ip_address,
        customerUserAgent: order.customer_user_agent,
        customerNote: order.customer_note,
        billing: {
            firstName: order.billing?.first_name,
            lastName: order.billing?.last_name,
            company: order.billing?.company,
            address1: order.billing?.address_1,
            address2: order.billing?.address_2,
            city: order.billing?.city,
            state: order.billing?.state,
            postcode: order.billing?.postcode,
            country: order.billing?.country,
            email: order.billing?.email,
            phone: order.billing?.phone
        },
        shipping: {
            firstName: order.shipping?.first_name,
            lastName: order.shipping?.last_name,
            company: order.shipping?.company,
            address1: order.shipping?.address_1,
            address2: order.shipping?.address_2,
            city: order.shipping?.city,
            state: order.shipping?.state,
            postcode: order.shipping?.postcode,
            country: order.shipping?.country
        },
        paymentMethod: order.payment_method,
        paymentMethodTitle: order.payment_method_title,
        transactionId: order.transaction_id,
        datePaid: order.date_paid ? new Date(order.date_paid) : null,
        dateCompleted: order.date_completed ? new Date(order.date_completed) : null,
        cartHash: order.cart_hash,
        metaData: order.meta_data,
        lineItems,
        shippingLines: order.shipping_lines,
        feeLines: order.fee_lines,
        couponLines: order.coupon_lines,
        refunds: order.refunds,
        website: site.name,
        updatedAt: new Date()
    };
}

export async function GET() {
    return NextResponse.json({
        ...syncProgress,
        debug: {
            logsCount: syncProgress.logs.length,
            lastLog: syncProgress.logs[syncProgress.logs.length - 1] || null
        }
    });
}

export async function POST(request: Request) {
    if (syncProgress.isSyncing) {
        return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 });
    }

    const { searchParams } = new URL(request.url);
    const forceFullSync = searchParams.get('full') === 'true';

    (async () => {
        const startTime = Date.now();
        let totalAdded = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;

        try {
            syncProgress = {
                isSyncing: true,
                currentStep: 'Connecting to databases...',
                progress: 0,
                total: 0,
                logs: [],
                startTime,
                currentOrderNumber: '',
                currentOrderDate: '',
                currentOrderTotal: 0,
                currentOrderCustomer: '',
                currentSite: '',
                fetchingPhase: false,
                fetchingPage: 0,
                fetchingFound: 0,
                fetchingSite: '',
                isFullSync: forceFullSync,
                stats: { added: 0, updated: 0, skipped: 0 }
            };

            await dbConnect();

            const websites = [
                {
                    name: process.env.KINGKKRATOMTITLE || 'KINGKKRATOM',
                    baseUrl: process.env.KINGKKRATOMAPI || '',
                    key: process.env.KINGKKRATOMCONSUMERKEY || '',
                    secret: process.env.KINGKKRATOMCONSUMERSECRET || ''
                },
                {
                    name: process.env.GRASSROOTSHARVESTTITLE || 'GRASSROOTSHARVEST',
                    baseUrl: process.env.GRASSROOTSHARVESTAPI || '',
                    key: process.env.GRASSROOTSHARVESTONSUMERKEY || '',
                    secret: process.env.GRASSROOTSHARVESTCONSUMERSECRET || ''
                },
                {
                    name: process.env.REBELXHQPRODUCERTITLE || 'GRHKTATOM',
                    baseUrl: process.env.REBELXHQPRODUCERAPI || '',
                    key: process.env.REBELXHQPRODUCERCONSUMERKEY || '',
                    secret: process.env.REBELXHQPRODUCERCONSUMERSECRET || ''
                },
                {
                    name: process.env.REBELXBRANDSRODUCERTITLE || 'REBELXBRANDS',
                    baseUrl: process.env.REBELXBRANDSRODUCERAPI || '',
                    key: process.env.REBELXBRANDSRODUCERCONSUMERKEY || '',
                    secret: process.env.REBELXBRANDSRODUCERCONSUMERSECRET || ''
                }
            ];

            // Preload WebProduct mapping
            syncProgress.currentStep = 'Loading web products...';
            const allWebProducts = await WebProduct.find({}).select('_id webId website image linkedSkuId variations').lean();
            const webProductMap = new Map<string, WebProductMapItem>();
            allWebProducts.forEach((wp: any) => {
                if (wp.webId) {
                    webProductMap.set(`${wp.webId}-${wp.website}`, wp);
                }
            });
            syncProgress.logs.push(`📦 Loaded ${allWebProducts.length} web products`);

            let allWebOrders: { site: any, order: any }[] = [];

            for (const site of websites) {
                if (!site.baseUrl || !site.key || !site.secret) {
                    syncProgress.logs.push(`⏭️ Skipping ${site.name}: Missing credentials`);
                    continue;
                }

                const syncMetaId = `web-orders-${site.name}`;
                const syncMeta = await SyncMeta.findById(syncMetaId).lean();
                const lastSyncAt = forceFullSync ? null : (syncMeta as any)?.lastSyncAt;

                if (lastSyncAt) {
                    syncProgress.currentStep = `Fetching order changes from ${site.name}...`;
                    syncProgress.logs.push(`📅 ${site.name}: Incremental since ${new Date(lastSyncAt).toLocaleString()}`);
                } else {
                    syncProgress.currentStep = `Fetching ALL orders from ${site.name}...`;
                    syncProgress.logs.push(`🔄 ${site.name}: Full sync`);
                }

                try {
                    const orders = await fetchOrdersFromWC(
                        site.baseUrl, site.key, site.secret, site.name,
                        lastSyncAt ? new Date(lastSyncAt) : undefined
                    );
                    orders.forEach(order => allWebOrders.push({ site, order }));
                    syncProgress.logs.push(`📋 ${site.name}: ${orders.length} orders`);
                } catch (err: any) {
                    syncProgress.logs.push(`❌ ${site.name}: ${err.message}`);
                }
            }

            syncProgress.total = allWebOrders.length;
            
            if (allWebOrders.length === 0) {
                syncProgress.currentStep = 'Complete - No changes detected';
                syncProgress.isSyncing = false;
                syncProgress.logs.push('✅ All orders are up to date!');
                return;
            }

            // ⚡ BULK PROCESSING
            syncProgress.currentStep = 'Processing orders in bulk...';
            syncProgress.logs.push(`⚡ Starting bulk processing of ${allWebOrders.length} orders...`);

            // Process in batches
            for (let batchStart = 0; batchStart < allWebOrders.length; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, allWebOrders.length);
                const batch = allWebOrders.slice(batchStart, batchEnd);
                
                syncProgress.progress = batchEnd;
                syncProgress.currentStep = `Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}...`;
                
                // Show last order in batch for progress feedback
                const lastOrder = batch[batch.length - 1];
                if (lastOrder) {
                    syncProgress.currentSite = lastOrder.site.name;
                    syncProgress.currentOrderNumber = lastOrder.order.number || lastOrder.order.id;
                    syncProgress.currentOrderDate = lastOrder.order.date_created || '';
                    syncProgress.currentOrderTotal = parseFloat(lastOrder.order.total) || 0;
                    syncProgress.currentOrderCustomer = `${lastOrder.order.billing?.first_name || ''} ${lastOrder.order.billing?.last_name || ''}`.trim();
                }

                // Identify SKUs needed for this batch
                const batchSkuIds = new Set<string>();
                batch.forEach(({ site, order }) => {
                    (order.line_items || []).forEach((item: any) => {
                        const wpKey = `${item.product_id}-${site.name}`;
                        const webProduct = webProductMap.get(wpKey);
                        if (webProduct) {
                            if (item.variation_id) {
                                const variant = webProduct.variations?.find((v: any) => v.id === item.variation_id);
                                if (variant?.linkedSkuId) batchSkuIds.add(variant.linkedSkuId);
                                else if (webProduct.linkedSkuId) batchSkuIds.add(webProduct.linkedSkuId);
                            } else if (webProduct.linkedSkuId) {
                                batchSkuIds.add(webProduct.linkedSkuId);
                            }
                        }
                    });
                });

                // Fetch lot balances for these SKUs
                const lotMap = await getAvailableLotsForSkus(Array.from(batchSkuIds));

                // Transform all orders in batch
                const transformedOrders = batch.map(({ site, order }) => transformOrder(order, site, webProductMap, lotMap));
                
                // Get existing order IDs to determine adds vs updates
                // Note: transformOrder uses upsert=true, so we rely on bulkWrite return val
                
                // Build bulk operations
                const bulkOps = transformedOrders.map(doc => ({
                    updateOne: {
                        filter: { _id: doc._id },
                        update: { $set: doc },
                        upsert: true
                    }
                }));

                // Execute bulk write
                try {
                    const result = await WebOrder.bulkWrite(bulkOps, { ordered: false });
                    totalAdded += result.upsertedCount;
                    totalUpdated += result.modifiedCount;
                    syncProgress.stats = { added: totalAdded, updated: totalUpdated, skipped: totalSkipped };
                } catch (bulkErr: any) {
                    syncProgress.logs.push(`⚠️ Batch error: ${bulkErr.message}`);
                    totalSkipped += batch.length;
                }
            }

            // Update totalWebOrders on WebProducts (not SKUs directly anymore, handled by sync)
            // Actually, we should update SKU counters too if needed, but sticking to WebProduct focus.
            // But Sku.totalWebOrders is deprecated/replaced by webProducts.
            // Let's keep Sku update for backward compat as requested ("Maintain Sync Logic").
            
            try {
                syncProgress.currentStep = 'Updating product order counts...';
                // Aggregate counts by webProductId
                const wpCounts = await WebOrder.aggregate([
                     { $match: { status: { $in: ['completed', 'shipped', 'Completed', 'Shipped', 'processing', 'Processing', 'pending', 'Pending'] } } },
                     { $unwind: "$lineItems" },
                     { $group: { 
                         _id: "$lineItems.webProductId", 
                         count: { $sum: 1 } 
                     }}
                ]);
                
                const wpUpdates = wpCounts.map(c => ({
                    updateOne: {
                        filter: { _id: c._id },
                        update: { $set: { totalWebOrders: c.count } }
                    }
                })).filter(op => op.updateOne.filter._id); // Filter nulls

                if (wpUpdates.length > 0) {
                    await WebProduct.bulkWrite(wpUpdates);
                }

            } catch (countErr: any) {
                syncProgress.logs.push(`⚠️ Order count update error: ${countErr.message}`);
            }

            // Update sync meta for each website
            const syncTime = new Date();
            for (const site of websites) {
                if (!site.baseUrl || !site.key || !site.secret) continue;
                
                const syncMetaId = `web-orders-${site.name}`;
                const siteOrderCount = await WebOrder.countDocuments({ website: site.name });
                
                await SyncMeta.findOneAndUpdate(
                    { _id: syncMetaId },
                    {
                        $set: {
                            type: 'orders',
                            website: site.name,
                            lastSyncAt: syncTime,
                            lastFullSyncAt: forceFullSync ? syncTime : undefined,
                            recordsCount: siteOrderCount,
                            lastSyncStats: {
                                added: totalAdded,
                                updated: totalUpdated,
                                deleted: 0,
                                duration: Date.now() - startTime
                            }
                        }
                    },
                    { upsert: true }
                );
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            syncProgress.currentStep = 'Complete';
            syncProgress.isSyncing = false;
            syncProgress.logs.push(`✅ Sync complete: ${totalAdded} added, ${totalUpdated} updated`);
            syncProgress.logs.push(`⏱️ Duration: ${duration}s (${(allWebOrders.length / parseFloat(duration)).toFixed(0)} orders/sec)`);

        } catch (error: any) {
            syncProgress.isSyncing = false;
            syncProgress.currentStep = 'Failed';
            syncProgress.logs.push(`❌ Global Error: ${error.message}`);
        }
    })();

    return NextResponse.json({ message: 'Sync started', mode: forceFullSync ? 'full' : 'incremental' });
}
