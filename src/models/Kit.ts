import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IKitLineItem {
    sku: string;
    qty: number;
}

export interface IKit extends Document {
    legacyId?: string;
    name: string;
    lineItems: IKitLineItem[];
    createdBy?: string;
    createdAt: Date;
}

const KitLineItemSchema = new Schema<IKitLineItem>({
    // _id auto-generated as ObjectId
    sku: { type: String, ref: 'Sku', required: true },
    qty: { type: Number, required: true }
});

const KitSchema = new Schema<IKit>({
    // _id auto-generated as ObjectId
    legacyId: { type: String, index: true, sparse: true },
    name: { type: String, required: true },
    lineItems: [KitLineItemSchema],
    createdBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Force schema refresh on hot reload
if (mongoose.models.Kit) {
    delete mongoose.models.Kit;
}
export const Kit: Model<IKit> = mongoose.model<IKit>('Kit', KitSchema);
