import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const ledgerSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party',
        required: true,
        index: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    // 'opening' = opening balance entry, 'bill' = sale/purchase invoice, 'payment' = money received/paid, 'adjustment' = manual
    type: {
        type: String,
        enum: ['opening', 'bill', 'payment', 'adjustment'],
        required: true,
    },
    // Reference to the source document
    refType: {
        type: String,
        enum: ['SalesOrder', 'PurchaseOrder', 'Manual'],
        default: 'Manual',
    },
    refId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    refNumber: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    // For Customers: Debit = they owe us (bill), Credit = they paid us (payment)
    // For Vendors: Debit = we paid them (payment), Credit = we owe them (bill)
    debit: {
        type: Number,
        default: 0,
        min: 0,
    },
    credit: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Running balance. Interpretation depends on partyType.
    balance: {
        type: Number,
        default: 0,
    },
    paymentMode: {
        type: String,
        enum: ['cash', 'cheque', 'upi', 'bank_transfer', 'other', 'discount'],
        default: 'cash',
    },
    notes: {
        type: String,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

ledgerSchema.index({ party: 1, partyType: 1, tenantId: 1, date: -1 });
ledgerSchema.index({ refId: 1, refType: 1 });
ledgerSchema.index({ tenantId: 1, createdAt: -1 }); // for balance recalc

const Ledger = appConn.model('Ledger', ledgerSchema);

export default Ledger;
