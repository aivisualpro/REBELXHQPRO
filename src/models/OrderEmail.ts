import mongoose from 'mongoose';

const OrderEmailSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SaleOrder', required: true, index: true },
    resendId: String, // Resend email ID for tracking
    from: { type: String, required: true },
    to: [{ type: String, required: true }],
    cc: [String],
    bcc: [String],
    subject: { type: String, required: true },
    body: String, // HTML body
    bodyText: String, // Plain text version
    hasAttachment: { type: Boolean, default: false },
    attachmentName: String,
    status: { type: String, enum: ['queued', 'sent', 'delivered', 'failed', 'bounced'], default: 'queued' },
    sentBy: { type: String, ref: 'RXHQUsers' }, // User who sent the email
    sentAt: { type: Date, default: Date.now },
    errorMessage: String,
});
OrderEmailSchema.index({ orderId: 1, sentAt: -1 });

// Force schema refresh — delete cached model to pick up enum changes
if (mongoose.models.OrderEmail) {
    delete mongoose.models.OrderEmail;
}
export default mongoose.model('OrderEmail', OrderEmailSchema);
