import mongoose, { Schema, Document } from 'mongoose';

export interface ITicket extends Omit<Document, '_id'> {
    _id: string;
    date: Date;
    requestedBy: string;
    subCategory: string;
    issue: string;
    reason: string;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    deadline?: Date;
    description: string;
    department: string;
    document?: string; // URL to document
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    createdBy: string; // User ID or Name
    createdAt: Date;
    completionNote?: string;
    completedBy?: string;
    completedAt?: Date;
}

const TicketSchema: Schema = new Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    date: { type: Date, default: Date.now },
    requestedBy: { type: String, ref: 'RXHQUsers', required: true },
    subCategory: { type: String },
    issue: { type: String, required: true },
    reason: { type: String },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    deadline: { type: Date },
    description: { type: String },
    department: { type: String },
    document: { type: String },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
    createdBy: { type: String }, // keeping as string for flexibility in imports
    completionNote: { type: String },
    completedBy: { type: String, ref: 'RXHQUsers' },
    completedAt: { type: Date }
}, {
    timestamps: true,
    _id: false
});

export default mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema);
