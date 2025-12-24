import { Currency } from 'lucide-react';
import mongoose from 'mongoose';

const SaleOrderSchema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    label: String, // Order ID/Label
    clientId: { type: String, ref: 'Client' },
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
        _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        orderNumber: String, // As per request, reference to sales order _id or label
        sku: { type: String, ref: 'Sku' },
        lotNumber: String,
        qtyShipped: Number,
        uom: String,
        cost: Number, // Cost from lot source (manufacturing/PO)
        price: Number,
        total: Number, // qty x price
        createdAt: { type: Date, default: Date.now }
    }],

    payments: [{
        _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        orderNumber: String, // Ref to order
        paymentAmount: Number,
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: String, ref: 'RXHQUsers' }
    }]
});

// Force schema refresh
export default mongoose.models.SaleOrder || mongoose.model('SaleOrder', SaleOrderSchema);
