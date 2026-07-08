import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const billOfMaterialSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    finishedGood: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    name: { type: String, required: true }, // BOM Name e.g. "Standard Chair Assm"
    rawMaterials: [{
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
        quantity: { type: Number, required: true, min: 0.001 },
        scrapPercentage: { type: Number, default: 0 } // Expected waste
    }],
    productionCost: { type: Number, default: 0 }, // Additional labor/overhead per unit
    notes: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default appConn.model('BillOfMaterial', billOfMaterialSchema);
