/**
 * Clear ALL pending_loading dispatch requests and reset linked orders to 'confirmed'.
 * This cleans up the Pending Loading queue completely.
 *
 * Run from server/:
 *   node scripts/clearPendingLoadingQueue.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;

async function main() {
    console.log('\n🧹 Clear Pending Loading Queue');
    console.log('================================\n');

    if (!MONGO_URI) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

    const conn = await mongoose.createConnection(MONGO_URI, { family: 4, dbName: 'inventorymanagement' }).asPromise();
    console.log(`✅ Connected | DB: ${conn.db.databaseName}\n`);

    const db = conn.db;
    const dispatchesColl  = db.collection('dispatches');
    const salesOrdersColl = db.collection('salesorders');

    // Find all pending_loading dispatch requests
    const pendingRequests = await dispatchesColl.find({ status: 'pending_loading' }).toArray();
    console.log(`Found ${pendingRequests.length} pending_loading dispatch request(s)\n`);

    if (pendingRequests.length === 0) {
        console.log('✅ Nothing to clear.');
        await conn.close();
        process.exit(0);
    }

    const affectedOrderIds = new Set();

    for (const dispatch of pendingRequests) {
        console.log(`  🗑️  Deleting: ${dispatch.dispatchNumber} → Order: ${dispatch.order}`);
        await dispatchesColl.deleteOne({ _id: dispatch._id });
        if (dispatch.order) affectedOrderIds.add(String(dispatch.order));
    }

    console.log(`\n  Deleted ${pendingRequests.length} pending request(s)\n`);

    // NOTE: pending_loading dispatches have NOT reduced any stock yet
    // (stock reduction only happens on 'fulfill' → status becomes 'dispatched')
    // So we only need to ensure the linked order stays/returns to 'confirmed'

    console.log(`  Resetting ${affectedOrderIds.size} linked order(s) to 'confirmed'...`);
    for (const orderId of affectedOrderIds) {
        const result = await salesOrdersColl.updateOne(
            { _id: new mongoose.Types.ObjectId(orderId) },
            { $set: { status: 'confirmed' } }
        );
        const order = await salesOrdersColl.findOne(
            { _id: new mongoose.Types.ObjectId(orderId) },
            { projection: { orderNumber: 1, status: 1 } }
        );
        if (order) {
            console.log(`    ✔ Order #${order.orderNumber} → ${order.status} (modified: ${result.modifiedCount})`);
        }
    }

    console.log('\n================================');
    console.log('✅ Pending Loading queue is now empty!');
    console.log('   Please hard-refresh the browser (Ctrl+Shift+R)');
    await conn.close();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
});
