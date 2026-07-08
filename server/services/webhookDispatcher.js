import axios from 'axios';
import crypto from 'crypto';
import Webhook from '../models/Webhook.js';

export const dispatchWebhook = async (tenantId, event, payload) => {
    try {
        const webhooks = await Webhook.find({ tenantId, events: event, isActive: true });
        for (const webhook of webhooks) {
            const signature = crypto.createHmac('sha256', webhook.secret)
                                    .update(JSON.stringify(payload))
                                    .digest('hex');
            
            try {
                await axios.post(webhook.url, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Siva-Signature': signature,
                        'X-Siva-Event': event
                    },
                    timeout: 5000
                });
                // Reset failure count on success
                if (webhook.failureCount > 0) {
                    webhook.failureCount = 0;
                    await webhook.save();
                }
            } catch (error) {
                console.error(`Webhook delivery failed for ${webhook.url}:`, error.message);
                webhook.failureCount += 1;
                if (webhook.failureCount >= 5) {
                    webhook.isActive = false; // Auto-disable after 5 failures
                }
                await webhook.save();
            }
        }
    } catch (error) {
        console.error('Webhook Dispatcher Error:', error);
    }
};
