import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const hsnSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'HSN code is required'],
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    gstRate: {
        type: Number,
        default: 0,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
}, {
    timestamps: true,
});

// Check if model already exists on this connection
const HSN = appConn.models.HSN || appConn.model('HSN', hsnSchema);

export default HSN;
