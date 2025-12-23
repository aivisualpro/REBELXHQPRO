import mongoose, { Schema, model, models } from 'mongoose';

const lineItemSchema = new Schema({
    _id: String, // Allow custom String IDs from import
    sku: {
        type: Schema.Types.Mixed, // ObjectId to SKU or String
        ref: 'Sku'
    },
    lotNumber: String,
    varianceId: String,
    orderNumber: String, // Ref to web order _id if needed, though items are embedded
    qty: Number,
    total: Number,
    website: String,
    createdAt: Date
});

const webOrderSchema = new Schema({
    _id: String, // Explicitly using String ID from import
    category: String,
    status: String,
    orderAmount: Number,
    tax: Number,
    firstName: String,
    lastName: String,
    city: String,
    state: String,
    postcode: String,
    email: String,
    createdAt: Date,
    lineItems: [lineItemSchema]
}, {
    timestamps: true, // We will override createdAt from import
    _id: false // We specify _id manually
});

// Allow _id to be explicitly set in Mongoose
webOrderSchema.set('_id', false);

// Force re-compile if needed
if (models.WebOrder) {
    delete models.WebOrder;
}

const WebOrder = model('WebOrder', webOrderSchema);

export default WebOrder;
