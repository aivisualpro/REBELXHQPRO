
import { config } from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

// Load env vars
config({ path: path.resolve(process.cwd(), '.env.local') });

// Dynamic imports for models/db to avoid loading before env vars
const loadModels = async () => {
    const { default: dbConnect } = await import('../src/lib/mongoose');
    const { default: Sku } = await import('../src/models/Sku');
    return { dbConnect, Sku };
};

interface VarianceImport {
    legacyId: string;
    sku: string; // Parent Legacy ID
    name: string;
    website: string;
    image: string;
}

// PASTE YOUR DATA HERE
const DATA: VarianceImport[] = [
    // Example:
    // { legacyId: 'VAR-001', sku: 'PARENT-LID-123', name: 'Blue Variant', website: 'mysite.com', image: '...' }
];

async function importVariances() {
    const { dbConnect, Sku } = await loadModels();
    await dbConnect();
    console.log('Connected to DB');

    if (DATA.length === 0) {
        console.log('No data to import. Please add data to the DATA array in the script.');
        process.exit(0);
    }

    console.log(`Starting import of ${DATA.length} variances...`);
    let successCount = 0;
    let errorCount = 0;

    for (const item of DATA) {
        try {
            // Find the parent SKU by matching item.sku (from import) to legacyId (in database)
            const parentSku = await Sku.findOne({ legacyId: item.sku });
            
            if (!parentSku) {
                console.log(`❌ Parent SKU not found - looking for legacyId: "${item.sku}" (variance legacyId: ${item.legacyId})`);
                errorCount++;
                continue;
            }

            console.log(`Found parent: ${parentSku.name} (legacyId: ${item.sku})`);

            // Check if variance already exists by its legacyId
            const existingVariance = parentSku.variances.find((v: any) => v.legacyId === item.legacyId);
            
            if (existingVariance) {
                console.log(`  -> Variance ${item.legacyId} already exists. Updating...`);
                existingVariance.name = item.name;
                existingVariance.website = item.website;
                existingVariance.image = item.image;
            } else {
                // Create new variance
                console.log(`  -> Adding new variance: ${item.name} (legacyId: ${item.legacyId})`);
                parentSku.variances.push({
                    _id: new mongoose.Types.ObjectId().toString(),
                    legacyId: item.legacyId,
                    name: item.name,
                    website: item.website,
                    image: item.image,
                    sku: '',
                    status: 'active' 
                });
            }
            
            await parentSku.save();
            console.log(`✓ Success: Variance "${item.name}" added/updated to parent "${parentSku.name}"`);
            successCount++;
            
        } catch (error) {
            console.error(`Error processing variance ${item.legacyId}:`, error);
            errorCount++;
        }
    }

    console.log('--------------------------------');
    console.log(`Import Complete.`);
    console.log(`Variances Imported: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    process.exit(0);
}

importVariances().catch(e => {
    console.error(e);
    process.exit(1);
});
