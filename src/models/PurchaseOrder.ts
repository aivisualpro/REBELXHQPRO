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
    createdAt: { type: Date, default: Date.now },

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

export default mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', PurchaseOrderSchema);
