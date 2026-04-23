import mongoose from 'mongoose';
import { getLotsWithBalances } from '../src/lib/lot-helpers';
import Sku from '../src/models/Sku';

async function test() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
    await mongoose.connect(process.env.MONGODB_URI);
    
    try {
        // Pick a random SKU that likely has lot history
        const sku = await Sku.findOne({ name: { $exists: true } }).lean();
        if (!sku) {
            console.log('No SKUs found.');
            return;
        }

        console.log(`\nTesting getLotsWithBalances for SKU: ${sku.name} (${sku._id})\n`);
        
        console.time('Execution Time');
        const lots = await getLotsWithBalances(sku._id.toString());
        console.timeEnd('Execution Time');
        
        console.log(`\nResult: Found ${lots.length} lots.\n`);
        console.log(JSON.stringify(lots.slice(0, 3), null, 2));
        if (lots.length > 3) console.log(`... and ${lots.length - 3} more lots.`);
        
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}

test();
