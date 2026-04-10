import mongoose from 'mongoose';

/**
 * Atomic counter for sequential ID generation.
 * Uses MongoDB's findOneAndUpdate with $inc to guarantee uniqueness
 * even under concurrent requests (race-condition-safe).
 */
const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // e.g. "saleOrderLabel"
    seq: { type: Number, default: 0 }
});

export default mongoose.models.Counter || mongoose.model('Counter', CounterSchema);
