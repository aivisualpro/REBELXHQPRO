import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Call', 'Text', 'Email', 'Visit'],
        required: true
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },
    comments: String,
    metadata: {
        phoneNumber: String,
        duration: String,
        googleVoiceLink: String,
        recordingAvailable: Boolean
    },
    createdBy: {
        type: String,
        ref: 'RXHQUsers'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

ActivitySchema.index({ client: 1 });
ActivitySchema.index({ createdAt: -1 });

export default mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
