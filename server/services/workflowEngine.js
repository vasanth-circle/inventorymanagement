import WorkflowRule from '../models/WorkflowRule.js';
import WorkflowExecution from '../models/WorkflowExecution.js';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { dispatchWebhook } from './webhookDispatcher.js';

export const evaluateRules = async (tenantId, trigger, entityId, payload) => {
    try {
        const rules = await WorkflowRule.find({ tenantId, trigger, isActive: true });
        for (const rule of rules) {
            let conditionsMet = true;
            for (const condition of rule.conditions) {
                const actualValue = payload[condition.field];
                switch (condition.operator) {
                    case 'equals': conditionsMet = actualValue == condition.value; break;
                    case 'not_equals': conditionsMet = actualValue != condition.value; break;
                    case 'greater_than': conditionsMet = actualValue > condition.value; break;
                    case 'less_than': conditionsMet = actualValue < condition.value; break;
                    case 'contains': conditionsMet = String(actualValue).includes(String(condition.value)); break;
                }
                if (!conditionsMet) break;
            }

            if (conditionsMet) {
                let log = ['Conditions met. Executing actions.'];
                let status = 'success';
                for (const action of rule.actions) {
                    try {
                        if (action.type === 'send_email') {
                            // Dummy email for now, in reality connect to SMTP
                            console.log(`[Workflow] Sending email to ${action.config.to}`);
                            log.push(`Sent email to ${action.config.to}`);
                        } else if (action.type === 'send_webhook') {
                            await axios.post(action.config.url, payload);
                            log.push(`Sent webhook to ${action.config.url}`);
                        } else if (action.type === 'create_task') {
                            console.log(`[Workflow] Creating task: ${action.config.title}`);
                            log.push(`Created task: ${action.config.title}`);
                        }
                    } catch (e) {
                        status = 'failure';
                        log.push(`Action ${action.type} failed: ${e.message}`);
                    }
                }
                await WorkflowExecution.create({
                    rule: rule._id,
                    tenantId,
                    triggeredBy: entityId,
                    status,
                    log
                });
                await WorkflowRule.findByIdAndUpdate(rule._id, { $inc: { runCount: 1 } });
            }
        }
    } catch (e) {
        console.error('Workflow Engine Error:', e);
    }
};
