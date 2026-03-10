import mongoose from 'mongoose';
import { coreConn } from '../config/db.js';

const tenantSchema = new mongoose.Schema({
    businessName: {
        type: String,
        required: true,
        trim: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['Trial', 'Active', 'Inactive', 'Suspended'],
        default: 'Trial',
    },
    apps: [{
        name: String, // e.g., 'inventory'
        enabled: Boolean,
        settings: mongoose.Schema.Types.Mixed
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // This would be the core user
    }
}, {
    timestamps: true,
    collection: 'tenants' // Explicitly set if different from model name
});

const Tenant = coreConn.model('Tenant', tenantSchema);

export default Tenant;
