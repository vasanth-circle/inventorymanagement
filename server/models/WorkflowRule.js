import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const workflowRuleSchema = new mongoose.Schema({
    name: { type: String, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    trigger: {
        type: String,
        enum: ['so_created', 'so_confirmed', 'stock_below_threshold', 'payment_received', 'grn_received', 'po_created'],
        required: true
    },
    conditions: [{
        field: String,
        operator: { type: String, enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains'] },
        value: mongoose.Schema.Types.Mixed
    }],
    actions: [{
        type: { type: String, enum: ['send_email', 'send_webhook', 'create_task', 'auto_create_po'] },
        config: mongoose.Schema.Types.Mixed // e.g. { to: 'email@example.com', subject: '...', body: '...' }
    }],
    isActive: { type: Boolean, default: true },
    runCount: { type: Number, default: 0 }
}, { timestamps: true });

export default appConn.model('WorkflowRule', workflowRuleSchema);
