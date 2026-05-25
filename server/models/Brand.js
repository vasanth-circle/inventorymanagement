import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Brand name is required'],
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

// Brand name must be unique within a tenant
brandSchema.index({ name: 1, tenantId: 1 }, { unique: true });

const Brand = appConn.model('Brand', brandSchema);

export default Brand;
