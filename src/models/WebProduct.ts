import mongoose from 'mongoose';

const VariationSchema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    id: Number,                    // WooCommerce variation ID
    name: String,
    website: String,
    image: String,
    sku: String,                   // WooCommerce SKU code
    price: Number,
    regularPrice: Number,
    salePrice: Number,
    status: String,
    stockQuantity: Number,
    stockStatus: String,
    attributes: [mongoose.Schema.Types.Mixed],
    dateCreated: Date,
    dateModified: Date,
    permalink: String,
    // SKU Linking Fields
    linkedSkuId: String,           // Links to SKU._id
});

const WebProductSchema = new mongoose.Schema({
    _id: { type: String },         // "WC-{website}-{webId}" or existing ID
    // Core Fields
    name: { type: String, required: true },
    image: String,
    website: String,               // KINGKKRATOM, GRASSROOTSHARVEST, etc.
    // WooCommerce Fields
    webId: Number,                 // WooCommerce product ID
    slug: String,
    permalink: String,
    dateCreated: Date,
    dateModified: Date,
    type: { type: String, default: 'simple' },  // "simple" | "variable"
    status: String,
    featured: Boolean,
    catalogVisibility: String,
    description: String,
    shortDescription: String,
    sku_code: String,              // WooCommerce SKU code
    price: Number,
    regularPrice: Number,
    salePrice: Number,
    dateOnSaleFrom: Date,
    dateOnSaleTo: Date,
    onSale: Boolean,
    purchasable: Boolean,
    totalSales: Number,
    virtual: Boolean,
    downloadable: Boolean,
    taxStatus: String,
    taxClass: String,
    manageStock: Boolean,
    stockQuantity: Number,
    stockStatus: String,
    backorders: String,
    lowStockAmount: Number,
    soldIndividually: Boolean,
    weight: String,
    dimensions: {
        length: String,
        width: String,
        height: String
    },
    shippingRequired: Boolean,
    shippingTaxable: Boolean,
    shippingClass: String,
    reviewsAllowed: Boolean,
    averageRating: String,
    ratingCount: Number,
    upsellIds: [Number],
    crossSellIds: [Number],
    parentId: Number,
    tags: [mongoose.Schema.Types.Mixed],
    webCategories: [{
        id: Number,
        name: String,
        slug: String
    }],
    webImages: [{
        id: Number,
        src: String,
        name: String,
        alt: String,
        dateCreated: Date,
        dateModified: Date
    }],
    webAttributes: [mongoose.Schema.Types.Mixed],
    metaData: [mongoose.Schema.Types.Mixed],
    // Variations (for variable products)
    variations: [VariationSchema],
    // SKU Linking Fields (for simple products)
    linkedSkuId: String,           // Links to SKU._id
    // Stats
    totalWebOrders: { type: Number, default: 0 },
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// Indexes for common queries
WebProductSchema.index({ website: 1 });
WebProductSchema.index({ webId: 1, website: 1 });
WebProductSchema.index({ linkedSkuId: 1 });
WebProductSchema.index({ 'variations.linkedSkuId': 1 });
WebProductSchema.index({ totalWebOrders: -1 });

export default mongoose.models.WebProduct || mongoose.model('WebProduct', WebProductSchema);
