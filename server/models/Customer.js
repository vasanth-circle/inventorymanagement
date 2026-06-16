import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        required: [true, 'Customer phone number is required'],
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
    // Project sites — useful for builder customers who have multiple construction sites
    sites: [{
        name: { type: String, required: true, trim: true },
        address: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true },
    }],
    isActive: {
        type: Boolean,
        default: true,
    },
    // Locking Feature Overrides
    unlockedUntil: {
        type: Date,
        default: null,
    },
    unlockComment: {
        type: String,
        trim: true,
        default: '',
    },
    unlockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
}, {
    timestamps: true,
});

customerSchema.index({ name: 'text', companyName: 'text', email: 'text', tenantId: 1 });
customerSchema.index({ name: 1, tenantId: 1 }, { unique: true });
customerSchema.index({ isActive: 1, tenantId: 1 });

const Customer = appConn.model('Customer', customerSchema);

export default Customer;
