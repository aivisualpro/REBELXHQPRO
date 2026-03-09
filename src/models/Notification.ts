import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    category: {
        type: String,
        enum: ['orders', 'timers', 'others'],
        required: true,
        index: true,
    },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    link: { type: String, default: '' },
    isRead: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

// Compound index for efficient queries
NotificationSchema.index({ isRead: 1, createdAt: -1 });
NotificationSchema.index({ category: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
