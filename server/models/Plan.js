import mongoose from 'mongoose';
import { coreConn } from '../config/db.js';

const planSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true, // e.g., 'Basic', 'Pro', 'Enterprise'
    },
    description: {
        type: String,
        trim: true,
    },
    priceMonthly: {
        type: Number,
        required: true,
        default: 0,
    },
    priceYearly: {
        type: Number,
        required: true,
        default: 0,
    },
    currency: {
        type: String,
        default: 'INR', // Default to INR based on app defaults
    },
    // Usage Limits
    maxUsers: {
        type: Number,
        default: 1, // 0 or null could mean unlimited
    },
    maxInvoicesPerMonth: {
        type: Number,
        default: 100,
    },
    storageLimitMB: {
        type: Number,
        default: 1024, // 1GB
    },
    modules: [{
        type: String, // e.g., 'crm', 'hrms', 'inventory', 'billing'
    }],
    isActive: {
        type: Boolean,
        default: true,
    },
    stripeProductId: { type: String, default: null },
    razorpayPlanId: { type: String, default: null },
}, {
    timestamps: true,
});

const Plan = coreConn.models.Plan || coreConn.model('Plan', planSchema);

export default Plan;
