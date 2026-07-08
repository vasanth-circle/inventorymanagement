import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const binLocationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    rack: { type: String, required: true },
    bin: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

binLocationSchema.index({ tenantId: 1, location: 1, rack: 1, bin: 1 }, { unique: true });

export default appConn.model('BinLocation', binLocationSchema);
