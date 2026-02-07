import mongoose, { Schema, Document } from 'mongoose';

export interface IOpeningBalance extends Document {
    sku: string;
    lotNumber: string;
    qty: number;
    uom: string;
    cost: number;
    expirationDate?: Date;
    createdAt: Date;
    createdBy?: mongoose.Types.ObjectId;
}

const OpeningBalanceSchema: Schema = new Schema({
    sku: { type: Schema.Types.Mixed, required: true },
    lotNumber: { type: String, required: true },
    qty: { type: Number, required: true },
    uom: { type: String, required: true },
    cost: { type: Number, default: 0 },
    expirationDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'RXHQUsers' }
});

export default mongoose.models.OpeningBalance || mongoose.model<IOpeningBalance>('OpeningBalance', OpeningBalanceSchema);
