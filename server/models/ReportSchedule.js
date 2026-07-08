import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const reportScheduleSchema = new mongoose.Schema({
    name: { type: String, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    reportType: { 
        type: String, 
        enum: ['daily_stock', 'overdue_payments', 'low_stock', 'weekly_sales'], 
        required: true 
    },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday
    time: { type: String, required: true }, // e.g. "09:00"
    recipients: [{ type: String }],
    isActive: { type: Boolean, default: true },
    lastRunAt: { type: Date }
}, { timestamps: true });

export default appConn.model('ReportSchedule', reportScheduleSchema);
