import express from 'express';
import ApiKey from '../models/ApiKey.js';
import crypto from 'crypto';
import Item from '../models/Item.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

const router = express.Router();

// Custom Middleware for API Key Auth
const requireApiKey = async (req, res, next) => {
    const rawKey = req.header('X-API-Key');
    if (!rawKey) return sendError(res, 401, 'API Key missing in X-API-Key header');
    
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyRecord = await ApiKey.findOne({ keyHash, isActive: true });
    
    if (!keyRecord) return sendError(res, 401, 'Invalid or inactive API Key');
    
    // Attach tenant logic
    req.tenantQuery = () => ({ tenantId: keyRecord.tenantId });
    keyRecord.lastUsedAt = new Date();
    await keyRecord.save();
    
    next();
};

router.use(requireApiKey);

// Sample public endpoints
router.get('/items', async (req, res) => {
    try {
        const items = await Item.find(req.tenantQuery()).select('name sku quantity brand size category price type');
        sendResponse(res, 200, items);
    } catch (e) {
        sendError(res, 500, e.message);
    }
});

// Used for testing webhook delivery
router.post('/webhooks/test', (req, res) => {
    console.log('[Webhook Receiver] Got payload:', req.body);
    console.log('[Webhook Receiver] Signature:', req.headers['x-siva-signature']);
    sendResponse(res, 200, {}, 'Webhook received');
});

export default router;
