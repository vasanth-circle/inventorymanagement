import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const grnSchema = new mongoose.Schema({
    grnNumber: {
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
    // ─── References ──────────────────────────────────────────────────────────
    purchaseOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
        required: [true, 'Purchase Order is required'],
    },
    purchaseOrderNumber: {
        type: String,
        trim: true,
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
    },
    // ─── Line Items ───────────────────────────────────────────────────────────
    items: [{
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
        name: String,
        orderedQuantity: { type: Number, default: 0 },       // qty from the PO
        receivedQuantity: { type: Number, required: true, min: 0 }, // qty physically received
        damagedQuantity: { type: Number, default: 0, min: 0 },
        acceptedQuantity: { type: Number, default: 0 },       // computed: received - damaged
        price: { type: Number, default: 0 },                  // purchase price at receipt time
        batchNumber: { type: String, trim: true },
        expiryDate: { type: Date },
        binLocation: { type: String, trim: true },
    }],
    // ─── Metadata ─────────────────────────────────────────────────────────────
    receiptDate: {
        type: Date,
        default: Date.now,
    },
    notes: {
        type: String,
        trim: true,
    },
    inspectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    // ─── Status ───────────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['draft', 'received', 'cancelled'],
        default: 'draft',
    },
    // Whether this GRN has triggered a stock inward transaction
    stockUpdated: {
        type: Boolean,
        default: false,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Compute acceptedQuantity before save
grnSchema.pre('validate', function (next) {
    this.items.forEach(item => {
        item.acceptedQuantity = Math.max(0, (item.receivedQuantity || 0) - (item.damagedQuantity || 0));
    });
    next();
});

grnSchema.index({ grnNumber: 1, tenantId: 1 }, { unique: true });
grnSchema.index({ purchaseOrder: 1, tenantId: 1 });
grnSchema.index({ tenantId: 1, createdAt: -1 });

const GoodsReceiptNote = appConn.model('GoodsReceiptNote', grnSchema);

export default GoodsReceiptNote;
