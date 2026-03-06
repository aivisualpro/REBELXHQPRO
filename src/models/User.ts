import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

/** Generate a short, URL-safe random ID (12 chars) */
function generateProfileId(): string {
    return crypto.randomBytes(9).toString('base64url'); // 12 chars, URL-safe
}

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
    workspaceId?: string;
    profileId: string;
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
    workspaceId: { type: String },
    profileId: { type: String, unique: true, index: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    // Google Integration Fields
    googleConnected: { type: Boolean, default: false },
    googleEmail: { type: String },
    googleRefreshToken: { type: String },
    googleAccessToken: { type: String },
    googleTokenExpiry: { type: Number },
}, {
    timestamps: true,
    _id: false // Disable auto _id generation so we can manually set it
});

// Auto-generate profileId on new documents
UserSchema.pre('save', function (next: any) {
    if (!this.profileId) {
        this.profileId = generateProfileId();
    }
    next();
});

export default mongoose.models.RXHQUsers || mongoose.model<IUser>('RXHQUsers', UserSchema);
