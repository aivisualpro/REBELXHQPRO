import mongoose, { Schema } from 'mongoose';

export interface ISyncMeta {
    _id: string; // e.g., "web-products-KINGKKRATOM" or "web-orders-GRASSROOTSHARVEST"
    type: 'products' | 'orders';
    website: string;
    lastSyncAt: Date | null;
    lastFullSyncAt: Date | null;
    recordsCount: number;
    lastSyncStats: {
        added: number;
        updated: number;
        deleted: number;
        duration: number; // ms
    };
    createdAt?: Date;
    updatedAt?: Date;
}

const SyncMetaSchema = new Schema<ISyncMeta>({
    _id: { type: String, required: true },
    type: { type: String, enum: ['products', 'orders'], required: true },
    website: { type: String, required: true },
    lastSyncAt: { type: Date, default: null },
    lastFullSyncAt: { type: Date, default: null },
    recordsCount: { type: Number, default: 0 },
    lastSyncStats: {
        added: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
        duration: { type: Number, default: 0 }
    }
}, { 
    timestamps: true,
    _id: false 
});

export default mongoose.models.SyncMeta || mongoose.model<ISyncMeta>('SyncMeta', SyncMetaSchema);
