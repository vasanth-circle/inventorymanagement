import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const roleSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    permissions: [{
        type: String, // E.g., 'dashboard', 'sales-orders', 'inventory', 'reports'
    }],
    isActive: {
        type: Boolean,
        default: true,
    },
    isDefault: {
        type: Boolean,
        default: false, // E.g. default 'admin' role that cannot be deleted
    }
}, {
    timestamps: true,
});

// Ensure role names are unique per tenant
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const Role = appConn.models.Role || appConn.model('Role', roleSchema);

export default Role;
