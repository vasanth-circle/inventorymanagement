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
        ref: 'User',
    }
}, {
    timestamps: true,
    collection: 'tenants'
});

const Tenant = coreConn.model('Tenant', tenantSchema);

export default Tenant;
