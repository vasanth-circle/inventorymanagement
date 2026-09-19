import mongoose from 'mongoose';
import { coreConn } from '../config/db.js';

const maintenanceLogSchema = new mongoose.Schema({
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, required: true, trim: true },
    cost: { type: Number, default: 0 },
    performedBy: { type: String, trim: true },
    type: {
        type: String,
        enum: ['Preventive', 'Corrective', 'Inspection', 'Upgrade', 'Other'],
        default: 'Other'
    }
}, { _id: true, timestamps: false });

const assetSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    // Identity
    assetTag: {
        type: String,
        trim: true,
        // e.g. AST-0001 — auto-generated on create
    },
    name: {
        type: String,
        required: [true, 'Asset name is required'],
        trim: true,
    },
    assetType: {
        type: String,
        enum: ['System', 'Vehicle', 'Furniture', 'Networking', 'Other'],
        required: true,
    },
    category: {
        type: String,
        enum: ['Laptop', 'Desktop', 'Server', 'Printer', 'Projector', 'Tablet', 'Phone', 'Car', 'Truck', 'Bike', 'Chair', 'Desk', 'Cabinet', 'Router', 'Switch', 'Other'],
        default: 'Other'
    },
    make: { type: String, trim: true },   // Brand / Manufacturer
    model: { type: String, trim: true },  // Model name/number
    condition: {
        type: String,
        enum: ['Excellent', 'Good', 'Fair', 'Poor'],
        default: 'Good'
    },

    // System-specific
    serialNumber: {
        type: String,
        trim: true,
    },

    // Vehicle-specific
    insuranceData: {
        policyNumber: { type: String, trim: true },
        provider: { type: String, trim: true },
        expiryDate: { type: Date },
    },

    // Financial
    purchaseDate: { type: Date },
    purchaseCost: { type: Number, default: 0 },
    currentValue: { type: Number, default: 0 },
    depreciationRate: { type: Number, default: 0 }, // % per year
    vendor: { type: String, trim: true }, // Supplier name

    // Warranty
    warrantyExpiry: { type: Date },

    // Assignment
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: [true, 'Branch/Location is required'],
    },
    assignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    // Lifecycle
    status: {
        type: String,
        enum: ['Available', 'Assigned', 'In Service', 'Returned', 'Retired'],
        default: 'Available',
    },

    // Maintenance history
    maintenanceLogs: [maintenanceLogSchema],

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
