import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const vendorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Vendor name is required'],
        trim: true,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        required: [true, 'Vendor phone number is required'],
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
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
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
    // If this vendor is also a customer, link to that Customer record
    // Enables combined ledger view (Sales + Purchase in one statement)
    linkedCustomerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
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

vendorSchema.index({ name: 'text', companyName: 'text', tenantId: 1 });
vendorSchema.index({ name: 1, tenantId: 1 }, { unique: true });

const Vendor = appConn.model('Vendor', vendorSchema);

export default Vendor;
