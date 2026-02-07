import mongoose, { Schema, Document } from 'mongoose';

export interface ITicket extends Document {
    date: Date;
    requestedBy: string;
    subCategory: string;
    issue: string;
    reason: string;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    deadline?: Date;
    description: string;
    department: string;
    document?: string;
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    createdBy: string;
    createdAt: Date;
    completionNote?: string;
    completedBy?: string;
    completedAt?: Date;
}

const TicketSchema: Schema = new Schema({
    // _id auto-generated as ObjectId
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
    createdBy: { type: String },
    completionNote: { type: String },
    completedBy: { type: String, ref: 'RXHQUsers' },
    completedAt: { type: Date }
}, {
    timestamps: true
});

// Force schema refresh on hot reload
if (mongoose.models.Ticket) {
    delete mongoose.models.Ticket;
}
export default mongoose.model<ITicket>('Ticket', TicketSchema);
