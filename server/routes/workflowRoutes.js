import express from 'express';
import {
    createWorkflowRule, getWorkflowRules, getWorkflowExecutions,
    createReportSchedule, getReportSchedules,
    createApiKey, getApiKeys, createWebhook, getWebhooks
} from '../controllers/phase2Controller.js';
import { protect as requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

// Workflow Rules
router.post('/rules', createWorkflowRule);
router.get('/rules', getWorkflowRules);
router.get('/executions', getWorkflowExecutions);

// Scheduled Reports
router.post('/schedules', createReportSchedule);
router.get('/schedules', getReportSchedules);

// API Keys & Webhooks
router.post('/api-keys', createApiKey);
router.get('/api-keys', getApiKeys);
router.post('/webhooks', createWebhook);
router.get('/webhooks', getWebhooks);

export default router;
