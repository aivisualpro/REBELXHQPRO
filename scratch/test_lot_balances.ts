import mongoose from 'mongoose';
import { getLotsWithBalances } from '../src/lib/lot-helpers';
import Sku from '../src/models/Sku';

async function test() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://adeel:Easports49971984@cluster1.2ttstsb.mongodb.net/RebelXHQSystems?authSource=admin');
    
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
