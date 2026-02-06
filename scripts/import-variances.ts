
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
        // Don't exit error, just info
        process.exit(0);
    }

    console.log(`Starting import of ${DATA.length} variances...`);
    let successCount = 0;
    let errorCount = 0;

    // Group by Parent SKU to minimize DB writes
    const groupedData = new Map<string, VarianceImport[]>();
    
    for (const item of DATA) {
        const parentId = item.sku;
        if (!groupedData.has(parentId)) {
            groupedData.set(parentId, []);
        }
        groupedData.get(parentId)?.push(item);
    }

    console.log(`Found ${groupedData.size} unique parent SKUs to update.`);

    for (const [parentLegacyId, variances] of groupedData) {
        try {
            const parentSku = await Sku.findOne({ legacyId: parentLegacyId });
            
            if (!parentSku) {
                console.log(`❌ Parent SKU not found for legacyId: ${parentLegacyId} (skipping ${variances.length} variances)`);
                errorCount += variances.length;
                continue;
            }

            console.log(`Processing Parent: ${parentSku.name} (${parentLegacyId}) - Adding ${variances.length} variances`);

            let updated = false;

            for (const item of variances) {
                // Check if variance already exists by legacyId to avoid duplicates?
                const exists = parentSku.variances.find((v: any) => v.legacyId === item.legacyId);
                
                if (exists) {
                     console.log(`  -> Variance ${item.legacyId} already exists. Updating...`);
                     exists.name = item.name;
                     exists.website = item.website;
                     exists.image = item.image;
                     // Update other fields if needed
                } else {
                    // Create new
                    parentSku.variances.push({
                        _id: new mongoose.Types.ObjectId().toString(),
                        legacyId: item.legacyId,
                        name: item.name,
                        website: item.website,
                        image: item.image,
                        // Defaults
                        sku: '', // The user didn't provide a SKU code for the variance itself, only the parent link
                        status: 'active' 
                    });
                }
                updated = true;
                successCount++;
            }

            if (updated) {
                await parentSku.save();
            }

        } catch (error) {
            console.error(`Error processing parent ${parentLegacyId}:`, error);
            errorCount += variances.length;
        }
    }

    console.log('--------------------------------');
    console.log(`Import Complete.`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    process.exit(0);
}

importVariances().catch(e => {
    console.error(e);
    process.exit(1);
});
