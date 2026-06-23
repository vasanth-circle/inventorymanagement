import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const expenseSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: [true, 'Expense date is required'],
        default: Date.now
    },
    voucherNumber: {
        type: String,
        trim: true,
        required: true,
        unique: true
    },
    category: {
        type: String,
        required: [true, 'Expense category is required'],
        trim: true
    },
    amount: {
        type: Number,
        required: [true, 'Expense amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    paymentMethod: {
        type: String,
        required: [true, 'Payment method is required'],
        enum: ['Cash', 'Bank', 'UPI', 'Credit Card', 'Other'],
        default: 'Cash'
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

// Compound index to ensure uniqueness per tenant if needed, though voucherNumber is usually globally unique by sequence
expenseSchema.index({ tenantId: 1, voucherNumber: 1 }, { unique: true });

const Expense = appConn.models.Expense || appConn.model('Expense', expenseSchema);

export default Expense;
