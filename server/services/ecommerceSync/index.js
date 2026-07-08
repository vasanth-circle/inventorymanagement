import { syncShopifyInventory, pullShopifyOrders } from './shopifySync.js';

export const syncInventory = async (tenantId, platform) => {
    if (platform === 'shopify') {
        return await syncShopifyInventory(tenantId);
    }
    throw new Error('Unsupported platform');
};

export const pullOrders = async (tenantId, platform) => {
    if (platform === 'shopify') {
        return await pullShopifyOrders(tenantId);
    }
    throw new Error('Unsupported platform');
};
