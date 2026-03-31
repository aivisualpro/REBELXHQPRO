import mongoose, { Schema } from 'mongoose';

const InventorySnapshotSchema = new Schema({
    _id: { type: String, required: true }, // SKU ID as string
    name: { type: String, index: true },
    category: { type: String, index: true },
    subCategory: { type: String, index: true },
    uom: { type: String },
    reOrderPoint: { type: Number, default: 0 },
    orderUpto: { type: Number, default: 0 },
    availableQty: { type: Number, default: 0, index: true },
    avgCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    computedAt: { type: Date, default: Date.now },
}, { _id: false, timestamps: false });

export default mongoose.models.InventorySnapshot ||
    mongoose.model('InventorySnapshot', InventorySnapshotSchema);
