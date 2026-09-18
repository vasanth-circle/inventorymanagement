import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const notificationSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // If null, means it's a broadcast to all users of a certain role
        default: null,
    },
    role: {
        type: String, // Broadcast to specific roles (e.g., 'admin')
        default: null,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    message: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info',
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    link: {
        type: String,
        trim: true,
    }
}, {
    timestamps: true,
});

const Notification = appConn.models.Notification || appConn.model('Notification', notificationSchema);

export default Notification;
