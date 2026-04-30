import mongoose, { Schema, Document } from 'mongoose';

export interface ITimeSheet extends Document {
    date: Date;
    user: string;        // email reference to /admin/users
    hourlyRate: number;  // pulled from user's hourlyRate
    timeIn: string;      // e.g. "6:29:00 AM"
    timeOut: string;     // e.g. "6:29:00 AM"
    createdAt: Date;
    createdBy: string;   // email of the user who created this entry
}

const TimeSheetSchema: Schema = new Schema({
    date: { type: Date, required: true, index: true },
    user: { type: String, required: true, index: true },       // email from /admin/users
    hourlyRate: { type: Number, default: 0 },                  // reference from user's hourlyRate
    timeIn: { type: String, required: true },                  // format: "6:29:00 AM"
    timeOut: { type: String, default: '' },                    // format: "6:29:00 AM"
    createdBy: { type: String },
}, {
    timestamps: true,
});

TimeSheetSchema.index({ date: -1, user: 1 });
TimeSheetSchema.index({ createdAt: -1 });

// Force re-register on hot reload to pick up schema changes
try { mongoose.deleteModel('rebelXTimeSheet'); } catch {}

export default mongoose.models.rebelXTimeSheet || mongoose.model<ITimeSheet>('rebelXTimeSheet', TimeSheetSchema);
