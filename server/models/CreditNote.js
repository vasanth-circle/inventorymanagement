import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const creditNoteSchema = new mongoose.Schema({
    creditNoteNumber: {
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
    salesOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
        default: null,
    },
    salesOrderNumber: {
        type: String,
        trim: true,
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer is required'],
    },
    // ─── Line Items ───────────────────────────────────────────────────────────
    items: [{
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        name: String,
        quantity: { type: Number, required: true, min: 0 },
        price: { type: Number, required: true, min: 0 },
        total: Number,
    }],
    // ─── Amounts ──────────────────────────────────────────────────────────────
    itemsTotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    reason: {
        type: String,
        required: [true, 'Reason is required'],
        trim: true,
    },
    notes: {
        type: String,
        trim: true,
    },
    // ─── Status ───────────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['draft', 'issued', 'void'],
        default: 'draft',
    },
    issueDate: {
        type: Date,
        default: Date.now,
    },
    // ─── Ledger ───────────────────────────────────────────────────────────────
    ledgerPosted: {
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

// Compute line totals before save
creditNoteSchema.pre('validate', function (next) {
    this.items.forEach(item => {
        item.total = (item.quantity || 0) * (item.price || 0);
    });
    this.itemsTotal = this.items.reduce((sum, i) => sum + (i.total || 0), 0);
    this.totalAmount = this.itemsTotal + (this.taxAmount || 0);
    next();
});

creditNoteSchema.index({ creditNoteNumber: 1, tenantId: 1 }, { unique: true });
creditNoteSchema.index({ customer: 1, tenantId: 1 });
creditNoteSchema.index({ salesOrder: 1, tenantId: 1 });
creditNoteSchema.index({ tenantId: 1, createdAt: -1 });

const CreditNote = appConn.model('CreditNote', creditNoteSchema);

export default CreditNote;
