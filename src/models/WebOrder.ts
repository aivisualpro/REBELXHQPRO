import mongoose from 'mongoose';

const LineItemSchema = new mongoose.Schema({
    id: Number,
    name: String,
    productId: Number, // WooCommerce product_id - links to webId on WebProduct
    variationId: Number,
    quantity: Number,
    taxClass: String,
    subtotal: Number,
    subtotalTax: Number,
    total: Number,
    totalTax: Number,
    taxes: [mongoose.Schema.Types.Mixed],
    metaData: [mongoose.Schema.Types.Mixed],
    sku: String,
    price: Number,
    image: String, // Product image for display
    parentProductId: String, // Legacy: Reference to Sku._id
    // NEW: Enrichment fields for SKU/Lot/Cost tracking
    webProductId: String,          // Reference to WebProduct._id
    linkedSkuId: String,           // Confirmed SKU link (from WebProduct)
    lotNumber: String,             // Allocated lot number (editable)
    cost: Number,                  // Cost from lot (auto-calculated)
});

const WebOrderSchema = new mongoose.Schema({
    _id: { type: String }, // WC Order Number as ID
    webId: Number, // WooCommerce order ID
    parentId: Number,
    number: String,
    orderKey: String,
    createdVia: String,
    version: String,
    status: String,
    currency: String,
    dateCreated: Date,
    dateModified: Date,
    discountTotal: Number,
    discountTax: Number,
    shippingTotal: Number,
    shippingTax: Number,
    cartTax: Number,
    total: Number,
    totalTax: Number,
    pricesIncludeTax: Boolean,
    customerId: Number,
    customerIpAddress: String,
    customerUserAgent: String,
    customerNote: String,
    billing: {
        firstName: String,
        lastName: String,
        company: String,
        address1: String,
        address2: String,
        city: String,
        state: String,
        postcode: String,
        country: String,
        email: String,
        phone: String
    },
    shipping: {
        firstName: String,
        lastName: String,
        company: String,
        address1: String,
        address2: String,
        city: String,
        state: String,
        postcode: String,
        country: String
    },
    paymentMethod: String,
    paymentMethodTitle: String,
    transactionId: String,
    datePaid: Date,
    dateCompleted: Date,
    cartHash: String,
    metaData: [mongoose.Schema.Types.Mixed],
    lineItems: [LineItemSchema],
    shippingLines: [mongoose.Schema.Types.Mixed],
    feeLines: [mongoose.Schema.Types.Mixed],
    couponLines: [mongoose.Schema.Types.Mixed],
    refunds: [mongoose.Schema.Types.Mixed],
    website: String, // Source website (KINGKKRATOM, GRASSROOTSHARVEST, etc.)
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// Force recompile if needed
if (mongoose.models.WebOrder) {
    delete mongoose.models.WebOrder;
}

export default mongoose.model('WebOrder', WebOrderSchema);
