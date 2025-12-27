import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import Sku from '@/models/Sku';
import SyncMeta from '@/models/SyncMeta';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

// Global state for progress tracking
let syncProgress = {
    isSyncing: false,
    currentStep: '',
    progress: 0,
    total: 0,
    logs: [] as string[],
    startTime: null as number | null,
    // Enhanced tracking
    isFullSync: false,
    currentSite: '',
    currentProductName: '',
    stats: { added: 0, updated: 0, skipped: 0 },
    fetchingPhase: false,
    fetchingPage: 0,
    fetchingFound: 0,
    fetchingSite: ''
};

async function fetchProductsFromWC(
    baseUrl: string, 
    key: string, 
    secret: string, 
    siteName: string,
    modifiedAfter?: Date
) {
    let allProducts: any[] = [];
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
            
            let url = `${apiBase}products?per_page=100&page=${page}`;
            if (modifiedAfter) {
                url += `&modified_after=${modifiedAfter.toISOString()}`;
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Basic ${auth}` },
                cache: 'no-store'
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`WooCommerce API Error (${res.status}): ${errText}`);
            }

            const data = await res.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                hasMore = false;
            } else {
                allProducts = allProducts.concat(data);
                syncProgress.fetchingFound = allProducts.length;
                page++;
                if (data.length < 100) hasMore = false;
            }
        } catch (error: any) {
            console.error(`Error fetching page ${page} from ${baseUrl}:`, error.message);
            hasMore = false;
            throw error;
        }
    }
    
    syncProgress.fetchingPhase = false;
    return allProducts;
}

async function fetchVariations(baseUrl: string, productId: number, key: string, secret: string) {
    const apiBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    
    const res = await fetch(`${apiBase}products/${productId}/variations?per_page=100`, {
        headers: { 'Authorization': `Basic ${auth}` },
        cache: 'no-store'
    });

    if (!res.ok) return [];
    return await res.json();
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

    // Start sync in background
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
                isFullSync: forceFullSync,
                currentSite: '',
                currentProductName: '',
                stats: { added: 0, updated: 0, skipped: 0 },
                fetchingPhase: false,
                fetchingPage: 0,
                fetchingFound: 0,
                fetchingSite: ''
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

            let allWebProducts: { site: any, p: any }[] = [];

            for (const site of websites) {
                if (!site.baseUrl || !site.key || !site.secret) {
                    syncProgress.logs.push(`⏭️ Skipping ${site.name}: Missing credentials`);
                    continue;
                }

                const syncMetaId = `web-products-${site.name}`;
                const syncMeta = await SyncMeta.findById(syncMetaId).lean();
                const lastSyncAt = forceFullSync ? null : (syncMeta as any)?.lastSyncAt;

                if (lastSyncAt) {
                    syncProgress.currentStep = `Fetching changes from ${site.name} since ${new Date(lastSyncAt).toLocaleDateString()}...`;
                    syncProgress.logs.push(`📅 ${site.name}: Incremental sync since ${new Date(lastSyncAt).toLocaleString()}`);
                } else {
                    syncProgress.currentStep = `Fetching ALL products from ${site.name} (full sync)...`;
                    syncProgress.logs.push(`🔄 ${site.name}: Full sync`);
                }

                try {
                    const products = await fetchProductsFromWC(
                        site.baseUrl, 
                        site.key, 
                        site.secret, 
                        site.name,
                        lastSyncAt ? new Date(lastSyncAt) : undefined
                    );
                    products.forEach(p => allWebProducts.push({ site, p }));
                    
                    if (lastSyncAt) {
                        syncProgress.logs.push(`📦 ${site.name}: ${products.length} changed products`);
                    } else {
                        syncProgress.logs.push(`📦 ${site.name}: ${products.length} total products`);
                    }
                } catch (err: any) {
                    syncProgress.logs.push(`❌ ${site.name}: ${err.message}`);
                }
            }

            syncProgress.total = allWebProducts.length;
            
            if (allWebProducts.length === 0) {
                syncProgress.currentStep = 'Complete - No changes detected';
                syncProgress.isSyncing = false;
                syncProgress.logs.push('✅ All products are up to date!');
                return;
            }
            
            syncProgress.currentStep = 'Syncing product details and variations...';

            for (let i = 0; i < allWebProducts.length; i++) {
                const { site, p } = allWebProducts[i];
                syncProgress.progress = i + 1;
                syncProgress.currentSite = site.name;
                syncProgress.currentProductName = p.name?.substring(0, 50) || `Product ${p.id}`;
                
                try {
                    // Generate WebProduct ID
                    const webProductId = p.sku?.trim() || `WC-${site.name}-${p.id}`;
                    
                    // Get existing WebProduct to preserve linkedSkuId
                    const existingWebProduct = await WebProduct.findById(webProductId).lean();
                    const isNew = !existingWebProduct;
                    
                    // Fetch variations for variable products
                    let variations: any[] = [];
                    if (p.type === 'variable' && p.variations?.length > 0) {
                        const vars = await fetchVariations(site.baseUrl, p.id, site.key, site.secret);
                        if (Array.isArray(vars)) {
                            // Get existing variations to preserve linkedSkuId
                            const existingVariations = (existingWebProduct as any)?.variations || [];
                            
                            variations = vars.map((v: any) => {
                                const existingVar = existingVariations.find((ev: any) => 
                                    ev.id === v.id || ev._id === v.id.toString()
                                );
                                return {
                                    _id: v.id.toString(),
                                    id: v.id,
                                    name: v.attributes?.map((a: any) => a.option).join(' / ') || v.sku || `Var ${v.id}`,
                                    website: site.name,
                                    image: v.image?.src || p.images?.[0]?.src || '',
                                    sku: v.sku,
                                    price: parseFloat(v.price) || 0,
                                    regularPrice: parseFloat(v.regular_price) || 0,
                                    salePrice: parseFloat(v.sale_price) || 0,
                                    status: v.status,
                                    stockQuantity: v.stock_quantity,
                                    stockStatus: v.stock_status,
                                    attributes: v.attributes,
                                    dateCreated: v.date_created ? new Date(v.date_created) : null,
                                    dateModified: v.date_modified ? new Date(v.date_modified) : null,
                                    permalink: v.permalink,
                                    // PRESERVE linkedSkuId from existing
                                    linkedSkuId: existingVar?.linkedSkuId || null
                                };
                            });
                        }
                    }

                    // Merge variations (preserve existing ones not in API response)
                    const existingVariations = (existingWebProduct as any)?.variations || [];
                    const mergedVariations = [...existingVariations];
                    variations.forEach(newV => {
                        const idx = mergedVariations.findIndex(mv => mv._id === newV._id);
                        if (idx > -1) {
                            // Preserve linkedSkuId when updating
                            mergedVariations[idx] = { 
                                ...mergedVariations[idx], 
                                ...newV,
                                linkedSkuId: mergedVariations[idx].linkedSkuId || newV.linkedSkuId
                            };
                        } else {
                            mergedVariations.push(newV);
                        }
                    });

                    // Upsert to WebProduct collection
                    await WebProduct.findOneAndUpdate(
                        { _id: webProductId },
                        {
                            $set: {
                                name: p.name,
                                image: p.images?.[0]?.src || '',
                                website: site.name,
                                updatedAt: new Date(),
                                // Full WooCommerce Mappings
                                webId: p.id,
                                slug: p.slug,
                                permalink: p.permalink,
                                dateCreated: p.date_created ? new Date(p.date_created) : null,
                                dateModified: p.date_modified ? new Date(p.date_modified) : null,
                                type: p.type,
                                status: p.status,
                                featured: p.featured,
                                catalogVisibility: p.catalog_visibility,
                                description: p.description,
                                shortDescription: p.short_description,
                                sku_code: p.sku,
                                price: parseFloat(p.price) || 0,
                                regularPrice: parseFloat(p.regular_price) || 0,
                                salePrice: parseFloat(p.price) || 0,
                                dateOnSaleFrom: p.date_on_sale_from ? new Date(p.date_on_sale_from) : null,
                                dateOnSaleTo: p.date_on_sale_to ? new Date(p.date_on_sale_to) : null,
                                onSale: p.on_sale,
                                purchasable: p.purchasable,
                                totalSales: p.total_sales,
                                virtual: p.virtual,
                                downloadable: p.downloadable,
                                taxStatus: p.tax_status,
                                taxClass: p.tax_class,
                                manageStock: p.manage_stock,
                                stockQuantity: p.stock_quantity,
                                stockStatus: p.stock_status,
                                backorders: p.backorders,
                                lowStockAmount: p.low_stock_amount,
                                soldIndividually: p.sold_individually,
                                weight: p.weight,
                                dimensions: p.dimensions,
                                shippingRequired: p.shipping_required,
                                shippingTaxable: p.shipping_taxable,
                                shippingClass: p.shipping_class,
                                reviewsAllowed: p.reviews_allowed,
                                averageRating: p.average_rating,
                                ratingCount: p.rating_count,
                                upsellIds: p.upsell_ids,
                                crossSellIds: p.cross_sell_ids,
                                parentId: p.parent_id,
                                tags: p.tags,
                                webCategories: p.categories?.map((c: any) => ({
                                    id: c.id,
                                    name: c.name,
                                    slug: c.slug
                                })),
                                webImages: p.images?.map((img: any) => ({
                                    id: img.id,
                                    src: img.src,
                                    name: img.name,
                                    alt: img.alt,
                                    dateCreated: img.date_created ? new Date(img.date_created) : null,
                                    dateModified: img.date_modified ? new Date(img.date_modified) : null
                                })),
                                webAttributes: p.attributes,
                                metaData: p.meta_data,
                                variations: mergedVariations,
                                // PRESERVE linkedSkuId (for simple products)
                                linkedSkuId: (existingWebProduct as any)?.linkedSkuId || null
                            }
                        },
                        { upsert: true }
                    );

                    // Also update Sku collection for backward compatibility
                    await Sku.findOneAndUpdate(
                        { _id: webProductId },
                        {
                            $set: {
                                name: p.name,
                                image: p.images?.[0]?.src || '',
                                website: site.name,
                                category: site.name,
                                isWebProduct: true,
                                updatedAt: new Date(),
                                webId: p.id,
                                slug: p.slug,
                                permalink: p.permalink,
                                type: p.type,
                                status: p.status,
                                salePrice: parseFloat(p.price) || 0,
                                regularPrice: parseFloat(p.regular_price) || 0,
                                stockQuantity: p.stock_quantity,
                                stockStatus: p.stock_status,
                                variances: mergedVariations
                            }
                        },
                        { upsert: true }
                    );
                    
                    if (isNew) {
                        totalAdded++;
                    } else {
                        totalUpdated++;
                    }
                    syncProgress.stats = { added: totalAdded, updated: totalUpdated, skipped: totalSkipped };
                    
                } catch (pErr: any) {
                    syncProgress.logs.push(`❌ Error on ${p.id} (${site.name}): ${pErr.message}`);
                    totalSkipped++;
                }
            }

            // Update sync meta for each website
            const syncTime = new Date();
            for (const site of websites) {
                if (!site.baseUrl || !site.key || !site.secret) continue;
                
                const syncMetaId = `web-products-${site.name}`;
                const siteProductCount = await WebProduct.countDocuments({ website: site.name });
                
                await SyncMeta.findOneAndUpdate(
                    { _id: syncMetaId },
                    {
                        $set: {
                            type: 'products',
                            website: site.name,
                            lastSyncAt: syncTime,
                            lastFullSyncAt: forceFullSync ? syncTime : undefined,
                            recordsCount: siteProductCount,
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

            syncProgress.currentStep = 'Complete';
            syncProgress.isSyncing = false;
            syncProgress.logs.push(`✅ Sync complete: ${totalAdded} added, ${totalUpdated} updated, ${totalSkipped} errors`);
            syncProgress.logs.push(`⏱️ Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        } catch (error: any) {
            syncProgress.isSyncing = false;
            syncProgress.currentStep = 'Failed';
            syncProgress.logs.push(`❌ Global Error: ${error.message}`);
        }
    })();

    return NextResponse.json({ message: 'Sync started', mode: forceFullSync ? 'full' : 'incremental' });
}
