import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    firstName: string;
    lastName: string;
    role: string;
    department: string;
    email: string;
    password: string;
    phone?: string;
    hourlyRate?: number;
    profileImage?: string;
    status: 'Active' | 'Inactive';
}

const UserSchema: Schema = new Schema({
    _id: { type: String, required: true }, // Using string for _id because user wants email as _id during import
    firstName: { type: String, required: true, index: true },
    lastName: { type: String, required: true, index: true },
    role: { type: String, required: true },
    department: { type: String, required: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    phone: { type: String },
    hourlyRate: { type: Number },
    profileImage: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
}, {
    timestamps: true,
    _id: false // Disable auto _id generation so we can manually set it
});

export default mongoose.models.RXHQUsers || mongoose.model<IUser>('RXHQUsers', UserSchema);
