import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const ecommerceOrderSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'EcommerceChannel', required: true },
    externalOrderId: { type: String, required: true },
    externalOrderNumber: { type: String },
    salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder' }, // Linked local SO
    status: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending' },
    rawPayload: { type: mongoose.Schema.Types.Mixed } // Save original payload just in case
}, { timestamps: true });

ecommerceOrderSchema.index({ channel: 1, externalOrderId: 1 }, { unique: true });

export default appConn.model('EcommerceOrder', ecommerceOrderSchema);
