import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const sizeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Size name is required'],
        trim: true,
    },
    width: {
        type: Number,
        required: true,
    },
    height: {
        type: Number,
        required: true,
    },
    unit: {
        type: String,
        default: 'inches', // or 'feet', 'cm', etc.
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

sizeSchema.index({ name: 1, tenantId: 1 }, { unique: true });

const Size = appConn.model('Size', sizeSchema);

export default Size;
