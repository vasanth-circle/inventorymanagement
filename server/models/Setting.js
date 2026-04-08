import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        required: true,
        unique: true,
    },
    companyName: {
        type: String,
        default: 'Your Company Name',
        trim: true,
    },
    address: {
        type: String,
        default: 'Your Company Address',
        trim: true,
    },
    phone1: {
        type: String,
        default: '',
        trim: true,
    },
    phone2: {
        type: String,
        default: '',
        trim: true,
    },
    gstNumber: {
        type: String,
        default: '',
        trim: true,
    },
    invoicePrefix: {
        type: String,
        default: 'INV',
    },
    estimatePrefix: {
        type: String,
        default: 'EST',
    },
}, { timestamps: true });

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
