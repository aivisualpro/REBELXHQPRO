import mongoose, { Schema, Document } from 'mongoose';

export interface IOpeningBalance extends Omit<Document, '_id'> {
    _id: string; // User imported ID or auto-generated
    sku: string; // Ref to SKU
    lotNumber: string;
    qty: number;
    uom: string;
    cost: number;
    expirationDate?: Date;
    createdAt: Date;
    createdBy?: mongoose.Types.ObjectId;
}

const OpeningBalanceSchema: Schema = new Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    sku: { type: String, ref: 'Sku', required: true },
    lotNumber: { type: String, required: true },
    qty: { type: Number, required: true },
    uom: { type: String, required: true },
    cost: { type: Number, required: true },
    expirationDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, ref: 'RXHQUsers' }
});

export default mongoose.models.OpeningBalance || mongoose.model<IOpeningBalance>('OpeningBalance', OpeningBalanceSchema);
