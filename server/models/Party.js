import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const partySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Party name is required'],
        trim: true,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        required: [true, 'Party phone number is required'],
        trim: true,
    },
    phone2: {
        type: String,
        trim: true,
    },
    companyName: {
        type: String,
        trim: true,
    },
    gstin: {
        type: String,
        trim: true,
        uppercase: true,
    },
    address: {
        billing: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        },
        shipping: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        }
    },
    openingBalance: {
        type: Number,
        default: 0,
    },
    currentBalance: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    // Project sites (legacy customer field)
    sites: [{
        name: { type: String, required: true, trim: true },
        address: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true },
    }],
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
}, {
    timestamps: true,
});

partySchema.index({ name: 'text', companyName: 'text', email: 'text', tenantId: 1 });
partySchema.index({ name: 1, tenantId: 1 }, { unique: true });
partySchema.index({ isActive: 1, tenantId: 1 });

const Party = appConn.model('Party', partySchema);

export default Party;
