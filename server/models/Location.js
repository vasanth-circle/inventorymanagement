import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const locationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Location name is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    type: {
        type: String,
        enum: ['inventory', 'asset'],
        default: 'inventory',
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

// Location name must be unique within a tenant and type
locationSchema.index({ name: 1, tenantId: 1, type: 1 }, { unique: true });

const Location = appConn.model('Location', locationSchema);

export default Location;
