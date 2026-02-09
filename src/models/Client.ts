import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
    legacyId: { type: String, unique: true, sparse: true }, // Optional: only for imported legacy records
    name: { type: String, required: true },
    description: String,
    salesPerson: { type: String, ref: 'RXHQUsers' },
    contactStatus: String,
    contactType: String,
    companyType: String,
    website: String,
    facebookPage: String,
    industry: String,
    forecastedAmount: Number,
    interactionCount: Number,
    notes: [{
        note: String,
        createdBy: String, // User ID or Name
        createdAt: { type: Date, default: Date.now }
    }],
    projectedCloseDate: Date,

    phones: [{
        value: String,
        label: String, // e.g. 'Main', 'Secondary', 'WhatsApp'
        isWhatsApp: Boolean
    }],

    emails: [{
        value: String,
        label: String // e.g. 'Main', 'Secondary'
    }],

    addresses: [{
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        label: String // e.g. 'Main', 'Secondary'
    }],

    contacts: [{
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
        phoneType: String,
        extension: String,
        role: String,
        status: { type: String, default: 'Active' },
        address: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        website: String,
        communicationPreference: String,
        followUpFrequency: String,
        createdAt: { type: Date, default: Date.now }
    }],

    billing: {
        nameOnCard: String,
        ccNumber: String,
        expirationDate: String,
        securityCode: String,
        zipCode: String
    },

    defaultShippingTerms: String,
    defaultPaymentMethod: String,

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Basic indexes for search and filtering
ClientSchema.index({ name: 1 });
ClientSchema.index({ salesPerson: 1 });
ClientSchema.index({ contactStatus: 1 });
ClientSchema.index({ contactType: 1 });
ClientSchema.index({ companyType: 1 });
ClientSchema.index({ 'emails.value': 1 });
ClientSchema.index({ 'phones.value': 1 });
ClientSchema.index({ 'addresses.city': 1 });
ClientSchema.index({ 'addresses.state': 1 });

if (mongoose.models.Client) {
    delete mongoose.models.Client;
}

export default mongoose.model('Client', ClientSchema);
