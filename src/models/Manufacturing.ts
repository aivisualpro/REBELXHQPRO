import mongoose from 'mongoose';

// Define Labor sub-schema explicitly
const LaborSchema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    type: String,
    user: { type: String, ref: 'RXHQUsers' },
    duration: String, // Format: HH:MM:SS
    hourlyRate: Number,
    createdAt: { type: Date, default: Date.now }
}, { _id: false }); // Disable auto _id since we're providing our own

const ManufacturingSchema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() }, // custom or auto
    sku: { type: String, ref: 'Sku', required: true }, // reference by SKU string ID
    recipesId: { type: String, ref: 'Recipe' },
    uom: String,
    qty: Number,
    qtyDifference: Number,
    scheduledStart: Date,
    scheduledFinish: Date,
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    label: String, // New field
    notes: [{
        _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        note: String,
        createdBy: { type: String, ref: 'RXHQUsers' },
        createdAt: { type: Date, default: Date.now }
    }],
    status: { type: String, default: 'Draft' }, // e.g. Draft, In Progress, Completed
    createdBy: { type: String, ref: 'RXHQUsers' },
    finishedBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now },

    lineItems: [{
        _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        lotNumber: String,
        label: String, // New field
        recipeId: String,
        sku: { type: String, ref: 'Sku' },
        uom: String,
        recipeQty: Number,
        sa: Number, // Stock Available? or Standard Amount? User said 'sa'
        qtyExtra: Number,
        qtyScrapped: Number,
        createdAt: { type: Date, default: Date.now }
    }],

    labor: [LaborSchema]
});

// Delete cached model if it exists to force schema refresh
if (mongoose.models.Manufacturing) {
    delete mongoose.models.Manufacturing;
}

export default mongoose.model('Manufacturing', ManufacturingSchema);
