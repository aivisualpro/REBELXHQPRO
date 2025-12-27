import dbConnect from '../src/lib/mongoose';
import Sku from '../src/models/Sku';
import WebProduct from '../src/models/WebProduct';
import WebOrder from '../src/models/WebOrder';

async function migrate() {
    const isDryRun = process.argv.includes('--dry-run');
    
    await dbConnect();
    console.log('Connected to MongoDB');
    console.log(isDryRun ? '🔍 DRY RUN MODE - No changes will be made' : '🚀 LIVE MODE - Changes will be saved');

    // Step 1: Find all web products in SKU collection
    const webSkus = await Sku.find({ isWebProduct: true }).lean();
    console.log(`\n📦 Found ${webSkus.length} web products in SKU collection`);

    let created = 0;
    let updated = 0;
    let errors = 0;
    
    const webProductOps: any[] = [];

    // Step 2: Prepare WebProduct operations
    for (const sku of webSkus) {
        try {
            const existingWP = await WebProduct.findById(sku._id).lean();
            
            const webProductData = {
                _id: sku._id,
                name: sku.name,
                image: sku.image,
                website: (sku as any).website,
                webId: (sku as any).webId,
                slug: (sku as any).slug,
                permalink: (sku as any).permalink,
                dateCreated: (sku as any).dateCreated,
                dateModified: (sku as any).dateModified,
                type: (sku as any).type || 'simple',
                status: (sku as any).status,
                featured: (sku as any).featured,
                catalogVisibility: (sku as any).catalogVisibility,
                description: (sku as any).description,
                shortDescription: (sku as any).shortDescription,
                sku_code: (sku as any).sku_code,
                price: (sku as any).price,
                regularPrice: (sku as any).regularPrice,
                salePrice: (sku as any).salePrice,
                dateOnSaleFrom: (sku as any).dateOnSaleFrom,
                dateOnSaleTo: (sku as any).dateOnSaleTo,
                onSale: (sku as any).onSale,
                purchasable: (sku as any).purchasable,
                totalSales: (sku as any).totalSales,
                virtual: (sku as any).virtual,
                downloadable: (sku as any).downloadable,
                taxStatus: (sku as any).taxStatus,
                taxClass: (sku as any).taxClass,
                manageStock: (sku as any).manageStock,
                stockQuantity: (sku as any).stockQuantity,
                stockStatus: (sku as any).stockStatus,
                backorders: (sku as any).backorders,
                lowStockAmount: (sku as any).lowStockAmount,
                soldIndividually: (sku as any).soldIndividually,
                weight: (sku as any).weight,
                dimensions: (sku as any).dimensions,
                shippingRequired: (sku as any).shippingRequired,
                shippingTaxable: (sku as any).shippingTaxable,
                shippingClass: (sku as any).shippingClass,
                reviewsAllowed: (sku as any).reviewsAllowed,
                averageRating: (sku as any).averageRating,
                ratingCount: (sku as any).ratingCount,
                upsellIds: (sku as any).upsellIds,
                crossSellIds: (sku as any).crossSellIds,
                parentId: (sku as any).parentId,
                tags: (sku as any).tags,
                webCategories: (sku as any).webCategories,
                webImages: (sku as any).webImages,
                webAttributes: (sku as any).webAttributes,
                metaData: (sku as any).metaData,
                variations: (sku as any).variances || [],
                linkedSkuId: (existingWP as any)?.linkedSkuId || null,
                totalWebOrders: (sku as any).totalWebOrders || 0,
                createdAt: (sku as any).createdAt || new Date(),
                updatedAt: (sku as any).updatedAt || new Date()
            };

            if (existingWP) {
                updated++;
                webProductOps.push({
                    updateOne: {
                        filter: { _id: sku._id },
                        update: { $set: webProductData }
                    }
                });
            } else {
                created++;
                webProductOps.push({
                    insertOne: {
                        document: webProductData
                    }
                });
            }
        } catch (err: any) {
            errors++;
            console.error(`❌ Error processing ${sku._id}: ${err.message}`);
        }
    }

    if (!isDryRun && webProductOps.length > 0) {
        console.log(`Writing ${webProductOps.length} WebProduct operations...`);
        await WebProduct.bulkWrite(webProductOps);
        console.log('✅ WebProducts creation/update complete.');
    } else if (isDryRun) {
        console.log(`[DRY RUN] Would write ${webProductOps.length} WebProduct operations.`);
    }

    // Step 3: Update WebOrder line items with webProductId
    console.log('\n📋 Updating WebOrder line items with webProductId...');
    
    // Build a map of webId+website -> webProductId for fast lookup
    const productMap = new Map();
    const allWebProducts = await WebProduct.find({}).select('_id webId website').lean();
    for (const wp of allWebProducts) {
        productMap.set(`${wp.webId}-${wp.website}`, wp._id);
    }
    console.log(`Loaded ${productMap.size} products for lookup.`);

    // Process orders in chunks using cursor
    const cursor = WebOrder.find({}).cursor();
    let ordersProcessed = 0;
    let ordersUpdated = 0;
    const orderOps: any[] = [];
    const BATCH_SIZE = 500;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        const order = doc as any;
        let modified = false;
        const updatedLineItems = [...(order.lineItems || [])];

        for (const li of updatedLineItems) {
            const key = `${li.productId}-${order.website}`;
            const wpId = productMap.get(key);
            
            if (wpId && !li.webProductId) { // Only update if missing
                li.webProductId = wpId;
                modified = true;
            }
        }

        if (modified) {
            ordersUpdated++;
            orderOps.push({
                updateOne: {
                    filter: { _id: order._id },
                    update: { $set: { lineItems: updatedLineItems } }
                }
            });
        }

        ordersProcessed++;
        if (ordersProcessed % 1000 === 0) console.log(`Processed ${ordersProcessed} orders...`);

        if (orderOps.length >= BATCH_SIZE && !isDryRun) {
            await WebOrder.bulkWrite(orderOps);
            orderOps.length = 0; // Clear array
        }
    }

    // Flush remaining
    if (!isDryRun && orderOps.length > 0) {
        await WebOrder.bulkWrite(orderOps);
    }

    console.log(`\n========== MIGRATION SUMMARY ==========`);
    console.log(`WebProducts Ops: ${webProductOps.length}`);
    console.log(`Orders Processed: ${ordersProcessed}`);
    console.log(`Orders Modified: ${ordersUpdated}`);
    console.log(isDryRun ? '\n🔍 DRY RUN - No changes were saved' : '\n✅ MIGRATION COMPLETE');

    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
