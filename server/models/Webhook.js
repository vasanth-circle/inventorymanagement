import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const webhookSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    url: { type: String, required: true },
    events: [{ type: String, enum: ['so_created', 'po_created', 'stock_updated', 'payment_received'] }],
    secret: { type: String, required: true }, // HMAC secret
    isActive: { type: Boolean, default: true },
    failureCount: { type: Number, default: 0 }
}, { timestamps: true });

export default appConn.model('Webhook', webhookSchema);
