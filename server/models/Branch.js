import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const branchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Branch name is required'],
        trim: true,
    },
    code: {
        type: String,
        required: [true, 'Branch code is required'],
        trim: true,
        uppercase: true,
    },
    address: {
        type: String,
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    isHeadOffice: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
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

// Branch code must be unique within a tenant
branchSchema.index({ code: 1, tenantId: 1 }, { unique: true });
branchSchema.index({ tenantId: 1, isActive: 1 });

const Branch = appConn.model('Branch', branchSchema);

export default Branch;
