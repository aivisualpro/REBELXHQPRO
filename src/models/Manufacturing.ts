import mongoose from 'mongoose';

// Define Labor sub-schema explicitly
const LaborSchema = new mongoose.Schema({
    // _id auto-generated as ObjectId
    type: String,
    user: { type: String, ref: 'RXHQUsers' },
    duration: String, // Format: HH:MM:SS
    hourlyRate: Number,
    createdAt: { type: Date, default: Date.now }
});

const ManufacturingSchema = new mongoose.Schema({
    // _id auto-generated as ObjectId
    legacyId: { type: String, index: true, sparse: true },
    label: String,
    sku: { type: String, ref: 'Sku', required: true }, // reference by SKU string ID
    recipesId: { type: String, ref: 'Recipe' },
    uom: String,
    qty: Number,
    qtyDifference: Number,
    scheduledStart: Date,
    scheduledFinish: Date,
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    notes: [{
        // _id auto-generated as ObjectId
        note: String,
        createdBy: { type: String, ref: 'RXHQUsers' },
        createdAt: { type: Date, default: Date.now }
    }],
    status: { type: String, default: 'Draft' }, // e.g. Draft, In Progress, Completed
    createdBy: { type: String, ref: 'RXHQUsers' },
    finishedBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now },

    lineItems: [{
        // _id auto-generated as ObjectId
        woNumber: String, // parent legacyId reference (kept for data lineage)
        lotNumber: String,
        label: String,
        recipeId: String,
        sku: { type: String, ref: 'Sku' },
        uom: String,
        recipeQty: Number,
        sa: Number,
        qtyExtra: Number,
        qtyScrapped: Number,
        cost: { type: Number, default: 0 }, // Unit cost from lot/opening balance
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: String, ref: 'RXHQUsers' }
    }],

    labor: [LaborSchema],

    // Cost tracking fields
    materialCost: { type: Number, default: 0 },
    packagingCost: { type: Number, default: 0 },
    laborCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 }
});

// Delete cached model if it exists to force schema refresh
if (mongoose.models.Manufacturing) {
    delete mongoose.models.Manufacturing;
}

export default mongoose.model('Manufacturing', ManufacturingSchema);
