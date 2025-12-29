import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    console.log('Loading modules...');
    const dbConnect = (await import('./src/lib/mongoose')).default;
    const WebOrder = (await import('./src/models/WebOrder')).default;

    console.log('Connecting...');
    await dbConnect();
    
    const productId = 37773; 
    const variationId = 38384; 
    const website = "GRHKTATOM"; // From recent logs

    console.log('--- DB QUERY TEST ---');
    console.log('SearchParams:', { productId, website, variationId });

    // 1. Check if orders exist at all for this product
    const productCount = await WebOrder.countDocuments({
        'lineItems.productId': productId,
        website: website
    });
    console.log('Total Orders for Product+Website:', productCount);

    // 2. Check explicitly with elemMatch
    const elemMatchCount = await WebOrder.countDocuments({
        website: website,
        'lineItems': {
            $elemMatch: {
                productId: productId,
                variationId: variationId
            }
        }
    });
    console.log('Total Orders with elemMatch (Number IDs):', elemMatchCount);

    // 3. Try with String IDs in case DB has mixed types
    const elemMatchCountStr = await WebOrder.countDocuments({
        website: website,
        'lineItems': {
            $elemMatch: {
                productId: productId,
                variationId: String(variationId) 
            }
        }
    });
    console.log('Total Orders with elemMatch (String VariationID):', elemMatchCountStr);

    // 4. Try with mismatched types (Product String, Variation Number)
    const elemMatchCountMixed1 = await WebOrder.countDocuments({
        website: website,
        'lineItems': {
            $elemMatch: {
                productId: String(productId),
                variationId: variationId
            }
        }
    });
    console.log('Total Orders with elemMatch (String ProductID, Number VariationID):', elemMatchCountMixed1);

    // 5. Fetch one order and inspect strictly
    const sampleOrder = await WebOrder.findOne({
        website: website,
        'lineItems': {
             $elemMatch: {
                productId: productId,
                variationId: variationId
             }
        }
    }).lean();

    if (sampleOrder) {
        console.log('Found Sample Order by Number ID Query:', sampleOrder._id);
        const item = sampleOrder.lineItems.find((i: any) => i.variationId == variationId);
        console.log('Sample Item from DB:', {
            productId: item.productId,
            variationId: item.variationId,
            productIdType: typeof item.productId,
            variationIdType: typeof item.variationId
        });
    } else {
        console.log('Could NOT find sample order with Number ID query.');
        // Try finding ANY order with the variation
        const anyOrder = await WebOrder.findOne({
             website: website,
            'lineItems.variationId': variationId
        }).select('lineItems').lean();
        
        if (anyOrder) {
             console.log('Found an order by simple variationId query.');
             const item = anyOrder.lineItems.find((i: any) => i.variationId == variationId);
             console.log('Item format in DB:', {
                productId: item.productId,
                variationId: item.variationId,
                productIdType: typeof item.productId,
                variationIdType: typeof item.variationId
            });
        }
    }

    process.exit(0);
}

debug();
