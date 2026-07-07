/**
 * Direct fix: Force-update order status using MongoDB updateOne (bypasses mongoose tracking issues).
 * Target orders: 126, 128, 131, 133
 *
 * Run from server/:
 *   node scripts/forceRevertToConfirmed.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;
const TARGET_ORDER_NUMBERS = ['126', '128', '131', '133'];

async function main() {
    console.log('\n🔧 Force Revert Orders to Confirmed');
    console.log('=====================================');

    if (!MONGO_URI) {
        console.error('❌ MONGODB_URI not set');
        process.exit(1);
    }

    // Connect directly to the inventorymanagement database
    const conn = await mongoose.createConnection(MONGO_URI, { family: 4, dbName: 'inventorymanagement' }).asPromise();
    console.log('✅ Connected | DB:', conn.db.databaseName, '\n');

    const db = conn.db; // raw MongoDB driver — no mongoose schema

    const salesOrdersColl = db.collection('salesorders');
    const dispatchesColl  = db.collection('dispatches');
    const itemsColl       = db.collection('items');
    const transactionsColl = db.collection('transactions');

    for (const orderNumber of TARGET_ORDER_NUMBERS) {
        console.log(`\n────────────────────────────────────`);
        console.log(`📋 Order #${orderNumber}`);

        // 1. Find the order
        const order = await salesOrdersColl.findOne({ orderNumber });
        if (!order) {
            console.log(`  ⚠️  Not found — skipping`);
            continue;
        }

        console.log(`  _id   : ${order._id}`);
        console.log(`  status: ${order.status}`);
        console.log(`  tenant: ${order.tenantId}`);

        if (order.status === 'confirmed') {
            console.log(`  ✅ Already confirmed — skipping`);
            continue;
        }

        // 2. Find all dispatches for this order
        const dispatches = await dispatchesColl.find({ order: order._id }).toArray();
        console.log(`  Dispatches found: ${dispatches.length}`);

        // 3. Revert stock for each dispatch
        for (const dispatch of dispatches) {
            console.log(`\n  🚛 ${dispatch.dispatchNumber} (${dispatch.status})`);

            for (const di of dispatch.items || []) {
                const itemDoc = await itemsColl.findOne({ _id: di.item });
                if (!itemDoc) {
                    console.log(`    ⚠️  Item ${di.item} not found`);
                    continue;
                }

                const revertQty = Number(di.quantity) || 0;
                if (revertQty <= 0) continue;

                const prevQty = itemDoc.quantity || 0;
                const newQty  = prevQty + revertQty;

                // Build the update — restore main quantity
                const itemUpdate = { $inc: { quantity: revertQty } };

                // Restore batch quantities using batchAllocations
                const batches = itemDoc.batches || [];
                const allocations = di.batchAllocations || [];

                if (allocations.length > 0) {
                    // We need to update batches sub-array in place
                    const updatedBatches = batches.map(b => {
                        const alloc = allocations.find(
                            a => a.batchId && a.batchId.toString() === b._id.toString()
                        );
                        if (alloc) {
                            return { ...b, quantity: (b.quantity || 0) + (alloc.quantity || 0) };
                        }
                        return b;
                    });
                    itemUpdate.$set = { batches: updatedBatches };
                }

                await itemsColl.updateOne({ _id: di.item }, itemUpdate);
                console.log(`    ✔ ${itemDoc.name}: ${prevQty} → ${newQty} (+${revertQty})`);

                // Record reversal transaction
                try {
                    await transactionsColl.insertOne({
                        item: di.item,
                        type: 'adjustment',
                        quantity: revertQty,
                        reason: `Dispatch Reverted — Order #${orderNumber} reset to Confirmed`,
                        notes: `Manual fix: Dispatch ${dispatch.dispatchNumber} cancelled. Stock restored.`,
                        user: new mongoose.Types.ObjectId('000000000000000000000001'),
                        previousQuantity: prevQty,
                        newQuantity: newQty,
                        fromLocation: itemDoc.location || '',
                        tenantId: order.tenantId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                } catch (e) {
                    console.log(`    ⚠️  Transaction log failed: ${e.message}`);
                }
            }

            // 4. Delete dispatch record
            await dispatchesColl.deleteOne({ _id: dispatch._id });
            console.log(`  🗑️  Dispatch ${dispatch.dispatchNumber} deleted`);
        }

        // 5. Force-update order status using raw updateOne (bypasses mongoose change tracking)
        const updateResult = await salesOrdersColl.updateOne(
            { _id: order._id },
            {
                $set: {
                    status: 'confirmed',
                    'items.$[].batchAllocations': []
                }
            }
        );

        if (updateResult.modifiedCount === 1) {
            console.log(`\n  ✅ Order #${orderNumber} → status FORCE-SET to 'confirmed'`);
        } else {
            console.log(`\n  ⚠️  Order #${orderNumber} — updateOne matched ${updateResult.matchedCount}, modified ${updateResult.modifiedCount}`);
        }

        // 6. Verify the change
        const verify = await salesOrdersColl.findOne({ _id: order._id }, { projection: { orderNumber: 1, status: 1 } });
        console.log(`  🔍 Verified status in DB: ${verify.status}`);
    }

    console.log('\n\n=====================================');
    console.log('✅ Done! Close this window and refresh the app.');
    await conn.close();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Script error:', err);
    process.exit(1);
});
