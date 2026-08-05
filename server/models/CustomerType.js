import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const customerTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Customer type name is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
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

// Customer Type name must be unique within a tenant
customerTypeSchema.index({ name: 1, tenantId: 1 }, { unique: true });

const CustomerType = appConn.model('CustomerType', customerTypeSchema);

export default CustomerType;
