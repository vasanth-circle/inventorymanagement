import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const vendorLedgerSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
        index: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    // 'opening' = opening balance entry, 'bill' = purchase/invoice, 'payment' = money paid to vendor, 'adjustment' = manual
    type: {
        type: String,
        enum: ['opening', 'bill', 'payment', 'adjustment'],
        required: true,
    },
    // Reference to PurchaseOrder (only for 'bill' type)
    refType: {
        type: String,
        enum: ['PurchaseOrder', 'Manual'],
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
    // Debit = We paid money to vendor (reduces our liability)
    debit: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Credit = We purchased something (increases our liability)
    credit: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Running balance after this entry (positive = we owe vendor, negative = advance paid to vendor)
    balance: {
        type: Number,
        default: 0,
    },
    paymentMode: {
        type: String,
        enum: ['cash', 'cheque', 'upi', 'bank_transfer', 'other'],
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

vendorLedgerSchema.index({ vendor: 1, tenantId: 1, date: -1 });
vendorLedgerSchema.index({ refId: 1, refType: 1 });

const VendorLedger = appConn.model('VendorLedger', vendorLedgerSchema);

export default VendorLedger;
