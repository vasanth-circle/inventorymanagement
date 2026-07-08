import WorkflowRule from '../models/WorkflowRule.js';
import WorkflowExecution from '../models/WorkflowExecution.js';
import ReportSchedule from '../models/ReportSchedule.js';
import ApiKey from '../models/ApiKey.js';
import Webhook from '../models/Webhook.js';
import EcommerceChannel from '../models/EcommerceChannel.js';
import EcommerceOrder from '../models/EcommerceOrder.js';
import crypto from 'crypto';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { syncInventory, pullOrders } from '../services/ecommerceSync/index.js';
import { extractInvoiceData } from '../services/ocrService.js';
import { bookShipment } from '../services/shippingService.js';
import Dispatch from '../models/Dispatch.js';

// ==========================================
// 1. Workflow Automation
// ==========================================
export const createWorkflowRule = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const rule = await WorkflowRule.create({ ...req.body, tenantId });
        sendResponse(res, 201, rule, 'Workflow rule created');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const getWorkflowRules = async (req, res) => {
    try {
        const rules = await WorkflowRule.find(tenantQuery(req));
        sendResponse(res, 200, rules);
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const getWorkflowExecutions = async (req, res) => {
    try {
        const execs = await WorkflowExecution.find(tenantQuery(req)).populate('rule', 'name').sort('-createdAt').limit(50);
        sendResponse(res, 200, execs);
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

// ==========================================
// 2. Scheduled Reports
// ==========================================
export const createReportSchedule = async (req, res) => {
    try {
        const schedule = await ReportSchedule.create({ ...req.body, tenantId: req.tenantId });
        sendResponse(res, 201, schedule, 'Schedule created');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const getReportSchedules = async (req, res) => {
    try {
        const schedules = await ReportSchedule.find(req.tenantQuery());
        sendResponse(res, 200, schedules);
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

// ==========================================
// 3. API Keys & Webhooks
// ==========================================
export const createApiKey = async (req, res) => {
    try {
        const rawKey = crypto.randomBytes(32).toString('hex');
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const prefix = rawKey.substring(0, 8);
        
        const key = await ApiKey.create({ 
            ...req.body, 
            keyHash, 
            prefix, 
            tenantId: req.tenantQuery().tenantId 
        });
        
        // Only return rawKey once
        sendResponse(res, 201, { key, rawKey }, 'API Key created. Save this key now, it will not be shown again.');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const getApiKeys = async (req, res) => {
    try {
        const keys = await ApiKey.find(req.tenantQuery()).select('-keyHash');
        sendResponse(res, 200, keys);
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const createWebhook = async (req, res) => {
    try {
        const secret = crypto.randomBytes(16).toString('hex');
        const webhook = await Webhook.create({ ...req.body, secret, tenantId: req.tenantQuery().tenantId });
        sendResponse(res, 201, webhook, 'Webhook registered');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const getWebhooks = async (req, res) => {
    try {
        const webhooks = await Webhook.find(req.tenantQuery());
        sendResponse(res, 200, webhooks);
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

// ==========================================
// 4. Shipping (Shiprocket)
// ==========================================
export const dispatchShipment = async (req, res) => {
    try {
        const { dispatchId } = req.params;
        const tenantId = req.tenantId;
        const dispatch = await Dispatch.findOne({ _id: dispatchId, tenantId });
        if (!dispatch) return sendError(res, 404, 'Dispatch not found');

        const shippingInfo = await bookShipment(tenantId, dispatch);
        
        dispatch.vehicleNumber = shippingInfo.carrier;
        dispatch.notes = (dispatch.notes ? dispatch.notes + '\n' : '') + `AWB: ${shippingInfo.awbNumber} | Tracking: ${shippingInfo.trackingUrl}`;
        await dispatch.save();

        sendResponse(res, 200, dispatch, 'Shipment booked successfully');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

// ==========================================
// 5. E-commerce Sync
// ==========================================
export const connectEcommerceChannel = async (req, res) => {
    try {
        const channel = await EcommerceChannel.create({ ...req.body, tenantId: req.tenantQuery().tenantId });
        sendResponse(res, 201, channel, 'Channel connected');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const getEcommerceChannels = async (req, res) => {
    try {
        const channels = await EcommerceChannel.find(req.tenantQuery());
        sendResponse(res, 200, channels);
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const triggerSync = async (req, res) => {
    try {
        const { channelId, action } = req.body;
        const tenantId = req.tenantId;
        const channel = await EcommerceChannel.findOne({ _id: channelId, tenantId });
        
        if (!channel) return sendError(res, 404, 'Channel not found');
        
        let result = {};
        if (action === 'push_inventory') {
            result = await syncInventory(tenantId, channel.platform);
        } else if (action === 'pull_orders') {
            result = await pullOrders(tenantId, channel.platform);
        }
        
        channel.lastSyncAt = new Date();
        await channel.save();
        
        sendResponse(res, 200, result, 'Sync completed');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

// ==========================================
// 6. OCR Bill Processing
// ==========================================
export const processOcrBill = async (req, res) => {
    try {
        if (!req.file) return sendError(res, 400, 'Image file required');
        
        const tenantId = req.tenantId;
        const data = await extractInvoiceData(req.file.buffer, tenantId);
        
        sendResponse(res, 200, data, 'Invoice processed');
    } catch (e) {
        sendError(res, 500, e.message);
    }
};
