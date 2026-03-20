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
        default: []
    },
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
