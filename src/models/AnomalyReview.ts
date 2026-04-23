import mongoose from 'mongoose';

const AnomalyReviewSchema = new mongoose.Schema({
    datasetHash: { type: String, index: true },
    promptVersion: { type: String, index: true },
    skuId: { type: String, index: true },
    moLegacyId: String,
    moId: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturing' },
    type: String, // 'labor-outlier', 'cost-deviation', 'duplicate-labor', etc.
    severity: { type: String, enum: ['high', 'medium', 'low'] },
    probableCause: String,
    recommendedAction: String,
    confidence: Number,
    baseline: mongoose.Schema.Types.Mixed,
    actual: mongoose.Schema.Types.Mixed,
    
    // Review status
    status: { type: String, enum: ['open', 'reviewed', 'dismissed', 'escalated'], default: 'open' },
    resolutionNotes: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'RXHQUsers' },
    reviewedAt: Date,

    // Audit trailing
    llmProvider: String,
    llmModel: String,
    llmTokensPrompt: Number,
    llmTokensCompletion: Number,
    
    createdAt: { type: Date, default: Date.now }
});

if (mongoose.models.AnomalyReview) {
    delete mongoose.models.AnomalyReview;
}

export default mongoose.model('AnomalyReview', AnomalyReviewSchema);
