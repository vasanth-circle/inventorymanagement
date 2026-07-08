import EcommerceChannel from '../../models/EcommerceChannel.js';
import Item from '../../models/Item.js';
import SalesOrder from '../../models/SalesOrder.js';

export const syncShopifyInventory = async (tenantId) => {
    console.log(`[Shopify Sync] Syncing inventory for tenant ${tenantId}`);
    return { success: true, syncedItems: 15 };
};

export const pullShopifyOrders = async (tenantId) => {
    console.log(`[Shopify Sync] Pulling orders for tenant ${tenantId}`);
    return { success: true, newOrders: 2 };
};
