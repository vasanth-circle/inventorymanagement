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
                
                // Special case for items: drop the old {tenantId, sku} index if it has tenantId first
                if (col.name === 'items' && index.unique && Object.keys(index.key).length === 2 && Object.keys(index.key)[0] === 'tenantId') {
                    console.log(`⚠️  Found outdated item index "${index.name}" with tenantId as first key. Dropping it...`);
                    await collection.dropIndex(index.name);
                    console.log(`✅ Outdated item index dropped.`);
                }
            }
            // Update existing locations to have type: 'inventory' if missing
            if (col.name === 'locations') {
                const result = await collection.updateMany(
                    { type: { $exists: false } },
                    { $set: { type: 'inventory' } }
                );
                if (result.modifiedCount > 0) {
                    console.log(`✅ Updated ${result.modifiedCount} existing locations to type: "inventory".`);
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
