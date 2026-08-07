import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const draftPOSchema = new mongoose.Schema({
    poNumber: {
        type: String,
        required: true,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
    vendorName: {
        type: String, // Optional string, no strict reference to Vendor needed for dummy PO
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true,
        },
        name: String,
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        price: {
            type: Number,
            default: 0,
        },
        unitType: {
            type: String,
        }
    }],
    totalAmount: {
        type: Number,
        default: 0,
    },
    notes: {
        type: String,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });

const DraftPO = appConn.model('DraftPO', draftPOSchema);
export default DraftPO;
