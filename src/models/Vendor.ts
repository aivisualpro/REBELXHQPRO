import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    name: { type: String, required: true },
    contactName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    website: String,
    paymentTerms: String, // CSV header 'payTerms' will map to this
    carrierPreference: String, // New field from CSV header 'carrierPreference'
    status: { type: String, default: 'Active' },
    notes: [{
        note: String,
        createdBy: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);
