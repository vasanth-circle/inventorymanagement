import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const dispatchSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
        required: [true, 'Order reference is required'],
    },
    dispatchNumber: {
        type: String,
        required: true,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
    vehicleNumber: {
        type: String,
        trim: true,
    },
    driverPhone: {
        type: String,
        trim: true,
    },
    dispatchDate: {
        type: Date,
        default: Date.now,
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 0.1,
        },
        unit: String, // e.g., 'SqFt', 'Pcs'
        batchAllocations: [{
            batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item.batches' },
            batchNumber: String,
            quantity: Number,
            purchasePrice: Number
        }],
    }],
    notes: String,
    status: {
        type: String,
        enum: ['pending', 'pending_loading', 'dispatched', 'cancelled'],
        default: 'dispatched',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true,
});

dispatchSchema.index({ dispatchNumber: 1, tenantId: 1 }, { unique: true });
dispatchSchema.index({ order: 1 });

const Dispatch = appConn.model('Dispatch', dispatchSchema);

export default Dispatch;
