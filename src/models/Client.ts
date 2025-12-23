import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Mapped from clientid
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

export default mongoose.models.Client || mongoose.model('Client', ClientSchema);
