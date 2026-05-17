import mongoose from 'mongoose';

const PurchaseOrderSchema = new mongoose.Schema({
    legacyId: { type: String, unique: true, sparse: true },
    label: String, // PO Number
    vendor: { type: String, ref: 'Vendor' },
    paymentTerms: String,
    createdBy: { type: String, ref: 'RXHQUsers' },
    status: { type: String, default: 'Draft' },
    scheduledDelivery: Date,
    receivedDate: Date,
    shippingCost: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },

    notes: [{
        note: { type: String, required: true },
        createdBy: { type: String, ref: 'RXHQUsers' },
        createdAt: { type: Date, default: Date.now },
    }],

    lineItems: [{
        legacyId: String, // Legacy support for AppSheet sync
        poNumber: String, // Reference to parent PO's legacyId
        sku: { type: String, ref: 'Sku' },
        lotNumber: String,
        qtyOrdered: Number,
        qtyReceived: Number,
        uom: String,
        cost: Number,
        amount: Number,
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: String, ref: 'RXHQUsers' }
    }]
});

PurchaseOrderSchema.index({ "lineItems.sku": 1, status: 1 });
PurchaseOrderSchema.index({ status: 1 }); // Stock endpoint: filter by status alone

export default mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', PurchaseOrderSchema);
