import mongoose, { Schema, Document } from 'mongoose';

export interface ILabResult extends Omit<Document, '_id'> {
    _id: string;
    name: string;
    variations: string[]; // Array of strings or IDs? Assuming strings for now as per "varitions" column
    brand: string;
    labTestStatus: string;
    labResultDate?: Date;
    company: string;
    link: string;
    createdAt: Date;
    updatedAt: Date;
}

const LabResultSchema: Schema = new Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    name: { type: String, required: true, index: true },
    variations: [{ type: String }],
    brand: { type: String, required: false },
    labTestStatus: { type: String, required: false },
    labResultDate: { type: Date },
    company: { type: String },
    link: { type: String },
}, {
    timestamps: true,
    _id: false
});

export default mongoose.models.LabResult || mongoose.model<ILabResult>('LabResult', LabResultSchema);
