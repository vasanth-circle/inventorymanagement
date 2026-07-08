import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const ecommerceChannelSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    platform: { type: String, enum: ['shopify', 'woocommerce'], required: true },
    shopDomain: { type: String, required: true },
    accessToken: { type: String }, // Assuming basic token based auth for simplicity
    syncEnabled: { type: Boolean, default: false },
    syncDirection: { type: String, enum: ['push', 'pull', 'both'], default: 'both' },
    lastSyncAt: { type: Date }
}, { timestamps: true });

export default appConn.model('EcommerceChannel', ecommerceChannelSchema);
