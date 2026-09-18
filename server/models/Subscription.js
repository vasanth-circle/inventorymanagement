import mongoose from 'mongoose';
import { coreConn } from '../config/db.js';

const subscriptionSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'past_due', 'canceled', 'trialing'],
        default: 'trialing',
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'yearly'],
        default: 'monthly',
    },
    currentPeriodStart: {
        type: Date,
    },
    currentPeriodEnd: {
        type: Date,
    },
    cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
    },
    // Payment Gateway References
    providerName: {
        type: String,
        enum: ['razorpay', 'stripe', 'manual', ''],
        default: '',
    },
    providerSubscriptionId: {
        type: String,
        default: null,
    },
    providerCustomerId: {
        type: String,
        default: null,
    }
}, {
    timestamps: true,
});

const Subscription = coreConn.models.Subscription || coreConn.model('Subscription', subscriptionSchema);

export default Subscription;
