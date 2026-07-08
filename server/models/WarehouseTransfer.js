import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const warehouseTransferSchema = new mongoose.Schema({
    transferNumber: {
        type: String,
        required: true,
        trim: true,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
    // ─── Source & Destination ─────────────────────────────────────────────────
    fromLocation: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
        name: { type: String, trim: true },
    },
    toLocation: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
        name: { type: String, trim: true },
    },
    // ─── Line Items ───────────────────────────────────────────────────────────
    items: [{
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
        name: String,
        quantity: { type: Number, required: true, min: 0.01 },
        unit: { type: String, trim: true },
        batchAllocations: [{
            batchId: { type: mongoose.Schema.Types.ObjectId },
            batchNumber: String,
            quantity: Number,
        }],
        serialNumbers: [{ type: String }],
    }],
    // ─── Status & Dates ───────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['draft', 'in_transit', 'received', 'cancelled'],
        default: 'draft',
    },
    transferDate: {
        type: Date,
        default: Date.now,
    },
    expectedReceiptDate: {
        type: Date,
    },
    receivedDate: {
        type: Date,
    },
    // ─── Notes ────────────────────────────────────────────────────────────────
    reason: {
        type: String,
        trim: true,
    },
    notes: {
        type: String,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

warehouseTransferSchema.index({ transferNumber: 1, tenantId: 1 }, { unique: true });
warehouseTransferSchema.index({ tenantId: 1, createdAt: -1 });
warehouseTransferSchema.index({ 'fromLocation.id': 1, tenantId: 1 });
warehouseTransferSchema.index({ 'toLocation.id': 1, tenantId: 1 });

const WarehouseTransfer = appConn.model('WarehouseTransfer', warehouseTransferSchema);

export default WarehouseTransfer;
