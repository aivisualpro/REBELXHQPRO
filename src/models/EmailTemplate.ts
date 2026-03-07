import mongoose from 'mongoose';

const EmailTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    subject: String,
    body: { type: String, required: true },
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

EmailTemplateSchema.index({ name: 1 });

// Force schema refresh
if (mongoose.models.EmailTemplate) {
    delete mongoose.models.EmailTemplate;
}
export default mongoose.model('EmailTemplate', EmailTemplateSchema);
