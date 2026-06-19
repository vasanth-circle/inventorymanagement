import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const transactionSchema = new mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: [true, 'Item is required'],
    },
    type: {
        type: String,
        enum: ['inward', 'outward', 'transfer', 'adjustment', 'return'],
        required: [true, 'Transaction type is required'],
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: 1,
    },
    damagedQuantity: {
        type: Number,
        default: 0,
        min: 0,
    },
    rate: {
        type: Number,
        default: 0,
    },
    reason: {
        type: String,
        trim: true,
    },
    batchId: {
        type: String, // Tracks the _id of the batch in the Item object
    },
    batchNumber: {
        type: String, // Human readable batch number
    },
    fromLocation: {
        type: String,
        trim: true,
    },
    toLocation: {
        type: String,
        trim: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required'],
    },
    notes: {
        type: String,
        trim: true,
    },
    previousQuantity: {
        type: Number,
        required: true,
    },
    newQuantity: {
        type: Number,
        required: true,
    },
    invoiceImage: {
        type: String,
        trim: true,
    },
    referenceOrder: {
        type: String, // Dynamic reference to SO or PO handle
        trim: true,
    },
    returnType: {
        type: String,
        enum: ['customer', 'vendor'],
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
    },
    settlementType: {
        type: String,
        enum: ['ledger', 'cash'],
        default: 'ledger'
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
}, {
    timestamps: true,
});

// Indexes for efficient querying
transactionSchema.index({ item: 1, createdAt: -1, tenantId: 1 });
transactionSchema.index({ type: 1, tenantId: 1 });
transactionSchema.index({ user: 1, tenantId: 1 });
transactionSchema.index({ tenantId: 1, createdAt: -1 }); // dashboard recent activity & list sort


const Transaction = appConn.model('Transaction', transactionSchema);

export default Transaction;
