import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const counterSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    tenantId: {
        type: String,
        required: true
    },
    seq: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound unique index for id and tenantId
counterSchema.index({ id: 1, tenantId: 1 }, { unique: true });

const Counter = appConn.model('Counter', counterSchema);

export default Counter;
