import mongoose from 'mongoose';

const SaleOrderSchema = new mongoose.Schema({
    // _id is now auto-generated as native ObjectId by MongoDB
    legacyId: { type: String, index: true, sparse: true }, // For import matching (same pattern as clients)
    label: { type: String, index: true, sparse: true, unique: true }, // Order ID/Label — unique enforced at DB level
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    salesRep: { type: String, ref: 'RXHQUsers' },
    discount: Number,
    paymentMethod: String,
    orderStatus: { type: String, default: 'Pending' },
    shippedDate: Date,
    shippingMethod: String,
    trackingNumber: String,
    shippingCost: Number,
    tax: Number,
    category: String,
    shippingAddress: String,
    city: String,
    state: String,
    lockPrice: Boolean,
    createdAt: { type: Date, default: Date.now },

    lineItems: [{
        // _id auto-generated as ObjectId
        legacyId: { type: String, sparse: true }, // For import matching from AppSheet
        orderNumber: String, // As per request, reference to sales order _id or label
        sku: { type: mongoose.Schema.Types.ObjectId, ref: 'Sku' },
        productDescription: String, // Product description from import
        lotNumber: String,
        qtyShipped: Number,
        uom: String,
        cost: Number, // Cost from lot source (manufacturing/PO)
        price: Number,
        total: Number, // qty x price
        createdAt: { type: Date, default: Date.now }
    }],

    payments: [{
        // _id auto-generated as ObjectId
        legacyId: { type: String, sparse: true }, // For AppSheet sync (delete/update)
        orderNumber: String, // Ref to order
        paymentAmount: Number,
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: String, ref: 'RXHQUsers' }
    }],

    notes: [{
        // _id auto-generated as ObjectId
        legacyId: String, // Used during import to reference parent order legacyId
        note: String,
        createdBy: { type: String, ref: 'RXHQUsers' },
        createdAt: { type: Date, default: Date.now }
    }],

    auditLog: [{
        userId:    { type: String },           // email or ID of the logged-in user
        timestamp: { type: Date, default: Date.now },
        field:     { type: String },           // e.g. 'orderStatus', 'lineItems', 'payments'
        from:      { type: mongoose.Schema.Types.Mixed }, // value before change
        to:        { type: mongoose.Schema.Types.Mixed }  // value after change
    }]
});

SaleOrderSchema.index({ clientId: 1 });
SaleOrderSchema.index({ orderStatus: 1 });
SaleOrderSchema.index({ "lineItems.sku": 1 });
SaleOrderSchema.index({ "lineItems.sku": 1, orderStatus: 1 });
// legacyId index is already defined inline with the field

// Force schema refresh
export default mongoose.models.SaleOrder || mongoose.model('SaleOrder', SaleOrderSchema);
