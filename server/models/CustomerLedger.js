import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const customerLedgerSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    // 'opening' = opening balance entry, 'bill' = sale/invoice, 'payment' = money received, 'adjustment' = manual
    type: {
        type: String,
        enum: ['opening', 'bill', 'payment', 'adjustment'],
        required: true,
    },
    // Reference to SalesOrder (only for 'bill' type)
    refType: {
        type: String,
        enum: ['SalesOrder', 'Manual'],
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
    // Debit = customer owes money (bill raised)
    debit: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Credit = customer paid money (payment received)
    credit: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Running balance after this entry (positive = customer owes, negative = advance)
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

customerLedgerSchema.index({ customer: 1, tenantId: 1, date: -1 });
customerLedgerSchema.index({ refId: 1, refType: 1 });
customerLedgerSchema.index({ tenantId: 1, createdAt: -1 }); // balance recalc sort


const CustomerLedger = appConn.model('CustomerLedger', customerLedgerSchema);

export default CustomerLedger;
