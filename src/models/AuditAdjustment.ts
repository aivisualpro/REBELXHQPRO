import mongoose, { Schema, model, models } from 'mongoose';

const auditAdjustmentSchema = new Schema({
    sku: {
        type: Schema.Types.Mixed, // Allow ObjectId or String ID/Name
        ref: 'Sku',
        required: [true, 'SKU is required']
    },
    lotNumber: {
        type: String,
        default: ''
    },
    qty: {
        type: Number,
        required: [true, 'Quantity is required']
    },
    reason: {
        type: String,
        default: ''
    },
    cost: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: Schema.Types.Mixed, // Allow ObjectId or String Name
        ref: 'RXHQUsers', 
        required: [true, 'Created By is required']
    }
}, {
    timestamps: true
});

// Force re-compile model for development schema changes
if (models.AuditAdjustment) {
    delete models.AuditAdjustment;
}

const AuditAdjustment = model('AuditAdjustment', auditAdjustmentSchema);

export default AuditAdjustment;
