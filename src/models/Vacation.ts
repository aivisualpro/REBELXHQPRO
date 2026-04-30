import mongoose, { Schema, Document } from 'mongoose';

export interface IVacation extends Document {
    employee: string;         // email
    employeeName: string;
    dateFrom: Date;
    dateTo: Date;
    totalDays: number;
    vacationType: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    reviewedBy: string;       // email of approver
    reviewedByName: string;
    reviewNote: string;
    reviewedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const VACATION_TYPES = [
    'Annual Leave',
    'Sick Leave',
    'Personal Leave',
    'Unpaid Leave',
    'Maternity/Paternity',
    'Bereavement',
    'Other',
];

const VacationSchema = new Schema<IVacation>({
    employee: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    dateFrom: { type: Date, required: true },
    dateTo: { type: Date, required: true },
    totalDays: { type: Number, required: true },
    vacationType: { type: String, enum: VACATION_TYPES, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
    reviewedBy: { type: String, default: '' },
    reviewedByName: { type: String, default: '' },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date },
}, {
    timestamps: true,
    collection: 'rebelXVacations',
});

VacationSchema.index({ dateFrom: -1 });
VacationSchema.index({ employee: 1, status: 1 });

try { mongoose.deleteModel('rebelXVacation'); } catch {}
export default mongoose.models.rebelXVacation || mongoose.model<IVacation>('rebelXVacation', VacationSchema);
