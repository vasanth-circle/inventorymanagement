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
    reason: {
        type: String,
        trim: true,
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
}, {
    timestamps: true,
});

// Indexes for efficient querying
transactionSchema.index({ item: 1, createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ user: 1 });

const Transaction = appConn.model('Transaction', transactionSchema);

export default Transaction;
