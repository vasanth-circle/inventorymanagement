import mongoose from 'mongoose';
import { coreConn } from '../config/db.js';

const assetSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, 'Asset name is required'],
        trim: true,
    },
    assetType: {
        type: String,
        enum: ['System', 'Vehicle', 'Furniture', 'Other'],
        required: true,
    },
    serialNumber: {
        type: String,
        trim: true,
        // specifically for systems/electronics
    },
    insuranceData: {
        // specifically for Vehicles
        policyNumber: { type: String, trim: true },
        provider: { type: String, trim: true },
        expiryDate: { type: Date },
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: [true, 'Branch/Location is required'],
    },
    assignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // Optional, might be unassigned
    },
    status: {
        type: String,
        enum: ['Available', 'Assigned', 'In Service', 'Returned', 'Retired'],
        default: 'Available',
    },
    notes: {
        type: String,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }
}, {
    timestamps: true,
});

// Check if model already exists on this connection
const Asset = coreConn.models.Asset || coreConn.model('Asset', assetSchema);

export default Asset;
