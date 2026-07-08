import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const apiKeySchema = new mongoose.Schema({
    name: { type: String, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    keyHash: { type: String, required: true }, // Store hashed key
    prefix: { type: String, required: true }, // Store prefix to show to user e.g. "key_1a2b..."
    scopes: [{ type: String, enum: ['read', 'write'] }],
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date }
}, { timestamps: true });

export default appConn.model('ApiKey', apiKeySchema);
