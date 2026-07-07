/**
 * Revert ALL dispatched/partially_dispatched sales orders back to 'confirmed'.
 * Uses raw MongoDB driver to ensure changes persist.
 *
 * Run from server/:
 *   node scripts/revertAllDispatchedToConfirmed.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;

async function main() {
    console.log('\n🔧 Revert ALL Dispatched Orders → Confirmed');
    console.log('=============================================\n');

    if (!MONGO_URI) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

    const conn = await mongoose.createConnection(MONGO_URI, { family: 4, dbName: 'inventorymanagement' }).asPromise();
    console.log(`✅ Connected | DB: ${conn.db.databaseName}\n`);

    const db = conn.db;
    const salesOrdersColl  = db.collection('salesorders');
    const dispatchesColl   = db.collection('dispatches');
    const itemsColl        = db.collection('items');
    const transactionsColl = db.collection('transactions');

    // Find ALL dispatched and partially_dispatched orders
    const orders = await salesOrdersColl.find({
        status: { $in: ['dispatched', 'partially_dispatched'] }
    }).toArray();

    console.log(`Found ${orders.length} order(s) to revert.\n`);

    if (orders.length === 0) {
        console.log('✅ Nothing to do.');
        await conn.close();
        process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;

    for (const order of orders) {
        try {
            console.log(`────────────────────────────────────`);
            console.log(`📋 #${order.orderNumber} | ${order.status} | tenant: ${order.tenantId}`);

            // Find dispatches for this order
            const dispatches = await dispatchesColl.find({ order: order._id }).toArray();
            console.log(`   Dispatches: ${dispatches.length}`);

            // Revert stock for each dispatch
            for (const dispatch of dispatches) {
                for (const di of dispatch.items || []) {
                    const itemDoc = await itemsColl.findOne({ _id: di.item });
                    if (!itemDoc) continue;

                    const revertQty = Number(di.quantity) || 0;
                    if (revertQty <= 0) continue;

                    const prevQty = itemDoc.quantity || 0;
                    const newQty  = prevQty + revertQty;

                    const itemUpdate = { $inc: { quantity: revertQty } };

                    // Restore batch allocations
                    const allocations = di.batchAllocations || [];
                    if (allocations.length > 0 && itemDoc.batches?.length > 0) {
                        const updatedBatches = (itemDoc.batches || []).map(b => {
                            const alloc = allocations.find(a => a.batchId && a.batchId.toString() === b._id.toString());
                            if (alloc) return { ...b, quantity: (b.quantity || 0) + (alloc.quantity || 0) };
                            return b;
                        });
                        itemUpdate.$set = { batches: updatedBatches };
                    }

                    await itemsColl.updateOne({ _id: di.item }, itemUpdate);
                    console.log(`   ✔ ${itemDoc.name}: ${prevQty} → ${newQty} (+${revertQty})`);

                    // Audit transaction
                    try {
                        await transactionsColl.insertOne({
                            item: di.item,
                            type: 'adjustment',
                            quantity: revertQty,
                            reason: `Dispatch Reverted — Order #${order.orderNumber} reset to Confirmed`,
                            notes: `Bulk revert script: Dispatch ${dispatch.dispatchNumber} cancelled.`,
                            user: new mongoose.Types.ObjectId('000000000000000000000001'),
                            previousQuantity: prevQty,
                            newQuantity: newQty,
                            fromLocation: itemDoc.location || '',
                            tenantId: order.tenantId,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                    } catch (_) { /* silent */ }
                }

                await dispatchesColl.deleteOne({ _id: dispatch._id });
                console.log(`   🗑️  Dispatch ${dispatch.dispatchNumber} deleted`);
            }

            // Force update status
            const result = await salesOrdersColl.updateOne(
                { _id: order._id },
                { $set: { status: 'confirmed', 'items.$[].batchAllocations': [] } }
            );

            if (result.modifiedCount === 1) {
                // Verify
                const v = await salesOrdersColl.findOne({ _id: order._id }, { projection: { status: 1 } });
                console.log(`   ✅ Status: ${v.status}`);
                successCount++;
            } else {
                console.log(`   ⚠️  No change (matched: ${result.matchedCount})`);
                errorCount++;
            }
        } catch (err) {
            console.error(`   ❌ Error processing #${order.orderNumber}: ${err.message}`);
            errorCount++;
        }
    }

    console.log('\n=============================================');
    console.log(`✅ Done! Reverted: ${successCount} | Errors: ${errorCount}`);
    await conn.close();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
