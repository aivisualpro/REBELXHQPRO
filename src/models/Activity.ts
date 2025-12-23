import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Call', 'Text', 'Email', 'Visit'],
        required: true
    },
    client: {
        type: String, // Storing Client _id (which is a string from Client.ts)
        ref: 'Client',
        required: true
    },
    comments: String,
    createdBy: {
        type: String,
        ref: 'RXHQUsers'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
