import mongoose from 'mongoose';

const SkuSchema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() }, // Mapped from 'sku' or auto-generated
    name: { type: String, required: true },
    image: String,
    category: String,
    subCategory: String,
    materialType: String,
    uom: String,
    salePrice: Number,
    orderUpto: Number,
    reOrderPoint: Number,
    kitApplied: { type: Boolean, default: false },
    isLotApplied: { type: Boolean, default: false },
    variances: [{
        _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        name: String,
        website: String,
        image: String
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Sku || mongoose.model('Sku', SkuSchema);
