import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const workflowExecutionSchema = new mongoose.Schema({
    rule: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowRule', required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId }, // The entity ID that triggered this
    status: { type: String, enum: ['success', 'failure'], required: true },
    log: [String] // Execution steps/errors
}, { timestamps: true });

export default appConn.model('WorkflowExecution', workflowExecutionSchema);
