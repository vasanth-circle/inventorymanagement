import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const productionOrderSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    orderNumber: { type: String, required: true }, // e.g. PO-001
    bom: { type: mongoose.Schema.Types.ObjectId, ref: 'BillOfMaterial', required: true },
    quantityToProduce: { type: Number, required: true, min: 1 },
    quantityProduced: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    status: { type: String, enum: ['planned', 'in_progress', 'completed', 'cancelled'], default: 'planned' },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default appConn.model('ProductionOrder', productionOrderSchema);
