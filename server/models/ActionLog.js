import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const actionLogSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    userName: {
        type: String,
        trim: true,
        default: 'Unknown',
    },
    userRole: {
        type: String,
        trim: true,
    },
    action: {
        type: String,
        required: true,
        trim: true,
    },
    entityType: {
        type: String,
        required: true,
        trim: true,
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    entityNumber: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});

const ActionLog = appConn.models.ActionLog || appConn.model('ActionLog', actionLogSchema);

export default ActionLog;
