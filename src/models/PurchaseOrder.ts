import mongoose from 'mongoose';

const PurchaseOrderSchema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    label: String, // PO Number
    vendor: { type: String, ref: 'Vendor' },
    paymentTerms: String,
    createdBy: { type: String, ref: 'RXHQUsers' },
    status: { type: String, default: 'Draft' },
    scheduledDelivery: Date,
    receivedDate: Date,
    createdAt: { type: Date, default: Date.now },

    lineItems: [{
        _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        sku: { type: String, ref: 'Sku' },
        lotNumber: String,
        qtyOrdered: Number,
        qtyReceived: Number,
        uom: String,
        cost: Number,
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: String, ref: 'RXHQUsers' }
    }]
});

export default mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', PurchaseOrderSchema);
