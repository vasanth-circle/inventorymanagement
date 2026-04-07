import { appConn } from '../config/db.js';

/**
 * Utility to identify and drop legacy global unique indexes that conflict with multi-tenancy.
 * This script ensures that entities like categories, items, etc. are only unique per tenant.
 */
const fixLegacyIndexes = async () => {
    const collectionsToFix = [
        { name: 'categories', globalField: 'name' },
        { name: 'locations', globalField: 'name' },
        { name: 'items', globalField: 'sku' },
        { name: 'customers', globalField: 'name' },
        { name: 'vendors', globalField: 'name' },
        { name: 'salesorders', globalField: 'orderNumber' },
        { name: 'purchaseorders', globalField: 'orderNumber' }
    ];

    console.log('🚀 Starting Universal Index Cleanup...');

    for (const col of collectionsToFix) {
        try {
            const collection = appConn.collection(col.name);
            const indexes = await collection.indexes();
            
            // Look for unique indexes that DON'T have tenantId as part of the key
            for (const index of indexes) {
                if (index.unique && !index.key.tenantId && index.name !== '_id_') {
                    console.log(`⚠️  Found conflicting global unique index "${index.name}" on collection "${col.name}". Dropping it...`);
                    await collection.dropIndex(index.name);
                    console.log(`✅ Index "${index.name}" dropped.`);
                }
            }
        } catch (error) {
            // Collection might not exist yet, which is fine
            if (error.codeName !== 'NamespaceNotFound') {
                console.warn(`Could not check indexes for collection "${col.name}":`, error.message);
            }
        }
    }
    
    console.log('🏁 Universal Index Cleanup complete.');
};

export default fixLegacyIndexes;
