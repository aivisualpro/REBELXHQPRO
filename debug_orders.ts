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
    
    const count = await WebOrder.countDocuments({ 'lineItems.productId': productId });
    console.log('Product Count:', count);

    const vCount = await WebOrder.countDocuments({
        'lineItems': {
            $elemMatch: {
                productId: productId,
                variationId: variationId
            }
        }
    });
    console.log('Variation Count:', vCount);
    
    // Check if maybe keys are strings
    const vCountStr = await WebOrder.countDocuments({
        'lineItems': {
            $elemMatch: {
                productId: productId,
                variationId: String(variationId) // Try string
            }
        }
    });
    console.log('Variation Count (String ID):', vCountStr);

    const sample = await WebOrder.findOne({ 'lineItems.productId': productId }).lean();
    if(sample) {
        // Find the line item
        const item = sample.lineItems.find((i: any) => i.productId == productId);
        if(item) {
             console.log('Sample Item Structure:', JSON.stringify(item, null, 2));
             console.log('Types:', {
                 id: typeof item.id,
                 productId: typeof item.productId,
                 variationId: typeof item.variationId
             });
        }
    }

    process.exit(0);
}

debug();
