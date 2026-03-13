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
    tenantId: {
        type: String,
        required: [true, 'Tenant ID is required'],
        index: true,
    },
}, {
    timestamps: true,
});

customerSchema.index({ name: 'text', companyName: 'text', email: 'text', tenantId: 1 });
customerSchema.index({ isActive: 1, tenantId: 1 });

const Customer = appConn.model('Customer', customerSchema);

export default Customer;
