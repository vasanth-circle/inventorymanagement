import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const vendorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Vendor name is required'],
        trim: true,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    companyName: {
        type: String,
        trim: true,
    },
    gstin: {
        type: String,
        trim: true,
        uppercase: true,
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
    },
    openingBalance: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    }
}, {
    timestamps: true,
});

vendorSchema.index({ name: 'text', companyName: 'text' });

const Vendor = appConn.model('Vendor', vendorSchema);

export default Vendor;
