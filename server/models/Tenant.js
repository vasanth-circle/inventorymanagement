import mongoose from 'mongoose';
import { coreConn } from '../config/db.js';

const tenantSchema = new mongoose.Schema({
    businessName: {
        type: String,
        required: true,
        trim: true,
    },
    tenantId: { // Alternative identifier often used in core systems
        type: String,
        unique: true,
        sparse: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Suspended', 'Trial', 'trial'],
        default: 'Trial',
    },
    apps: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    config: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    contactEmail: {
        type: String,
        trim: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
    },
    trialEndsAt: {
        type: Date,
    },
    billingStatus: {
        type: String,
        enum: ['active', 'past_due', 'canceled', 'trialing'],
        default: 'trialing',
    }
}, {
    timestamps: true,
    collection: 'tenants'
});

const Tenant = coreConn.model('Tenant', tenantSchema);

export default Tenant;
