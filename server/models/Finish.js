import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const finishSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Finish name is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
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

// Finish name must be unique within a tenant
finishSchema.index({ name: 1, tenantId: 1 }, { unique: true });

const Finish = appConn.models.Finish || appConn.model('Finish', finishSchema);

export default Finish;
