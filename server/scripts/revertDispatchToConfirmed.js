/**
 * One-time fix script: Revert specific sales orders from dispatched/partially_dispatched
 * back to 'confirmed' status, restoring all dispatched stock to inventory.
 *
 * Target orders: 126, 128, 131, 133
 *
 * What this script does:
 *  1. Finds each order by orderNumber
 *  2. Finds all dispatches linked to that order
 *  3. Reverts stock (adds back dispatched qty to Item.quantity + batch quantities)
 *  4. Creates audit/reversal Transaction records
 *  5. Deletes the dispatch records
 *  6. Resets the order status to 'confirmed'
 *  7. Clears batchAllocations on order items
 *
 * Run from: server/
 *   node --experimental-vm-modules scripts/revertDispatchToConfirmed.js
 *   -- OR (if package.json has "type":"module") --
 *   node scripts/revertDispatchToConfirmed.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

// ─── Target order numbers to revert ──────────────────────────────────────────
const TARGET_ORDER_NUMBERS = ['126', '128', '131', '133'];

// ─── MongoDB URI ──────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;
if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
}

// ─── Inline schemas (strict:false to avoid schema mismatch) ──────────────────
const soSchema       = new mongoose.Schema({}, { strict: false });
const dispatchSchema = new mongoose.Schema({}, { strict: false });
const itemSchema     = new mongoose.Schema({}, { strict: false });
const txSchema       = new mongoose.Schema({}, { strict: false });

// We connect directly to the app db (inventorymanagement)
let conn;

async function main() {
    console.log('\n🔧 Revert Dispatch → Confirmed Fix Script');
    console.log('==========================================');
    console.log(`Target Orders: ${TARGET_ORDER_NUMBERS.join(', ')}\n`);

    // Connect to the inventorymanagement database directly
    conn = await mongoose.createConnection(MONGO_URI, { family: 4 }).asPromise();
    console.log('✅ Connected to MongoDB\n');

    const SalesOrder = conn.model('SalesOrder', soSchema);
    const Dispatch   = conn.model('Dispatch', dispatchSchema);
    const Item       = conn.model('Item', itemSchema);
    const Transaction = conn.model('Transaction', txSchema);

    // Use a fake system user id for transaction records (fallback)
    const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000001');

    for (const orderNumber of TARGET_ORDER_NUMBERS) {
        console.log(`\n────────────────────────────────────────`);
        console.log(`📋 Processing Order #${orderNumber}`);
        console.log(`────────────────────────────────────────`);

        // 1. Find the sales order
        const order = await SalesOrder.findOne({ orderNumber });
        if (!order) {
            console.log(`  ⚠️  Order #${orderNumber} not found — skipping`);
            continue;
        }

        console.log(`  Found: ${order._id}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Customer: ${order.customer}`);
        console.log(`  TenantId: ${order.tenantId}`);

        if (order.status === 'confirmed') {
            console.log(`  ✅ Already in 'confirmed' status — skipping`);
            continue;
        }

        // 2. Find all dispatches for this order
        const dispatches = await Dispatch.find({ order: order._id });
        console.log(`  Found ${dispatches.length} dispatch record(s)`);

        // 3. Revert stock for each dispatch
        for (const dispatch of dispatches) {
            console.log(`\n  🚛 Dispatch: ${dispatch.dispatchNumber} (status: ${dispatch.status})`);

            for (const dispatchItem of dispatch.items || []) {
                const itemDoc = await Item.findById(dispatchItem.item);
                if (!itemDoc) {
                    console.log(`    ⚠️  Item ${dispatchItem.item} not found — skipping stock revert`);
                    continue;
                }

                const revertQty = Number(dispatchItem.quantity) || 0;
                if (revertQty <= 0) continue;

                const previousQuantity = itemDoc.quantity;

                // Revert batch quantities using batchAllocations
                let batchNote = 'No batch allocations';
                if (dispatchItem.batchAllocations && dispatchItem.batchAllocations.length > 0) {
                    for (const alloc of dispatchItem.batchAllocations) {
                        if (alloc.batchId && itemDoc.batches) {
                            // batches is a subdocument array; find by _id string match
                            const batch = itemDoc.batches.find(
                                b => b._id.toString() === alloc.batchId.toString()
                            );
                            if (batch) {
                                batch.quantity = (batch.quantity || 0) + (alloc.quantity || 0);
                            }
                        }
                    }
                    batchNote = `${dispatchItem.batchAllocations.length} batch allocation(s) reverted`;
                }

                // Revert main stock quantity
                itemDoc.quantity = previousQuantity + revertQty;
                await itemDoc.save();

                console.log(`    ✔ ${itemDoc.name}: ${previousQuantity} → ${itemDoc.quantity} (+${revertQty}) | ${batchNote}`);

                // 4. Create reversal transaction for audit trail
                try {
                    await Transaction.create({
                        item: dispatchItem.item,
                        type: 'adjustment',
                        quantity: revertQty,
                        reason: `Dispatch Reverted — Order #${order.orderNumber} reset to Confirmed`,
                        notes: `Script revert: Dispatch ${dispatch.dispatchNumber} cancelled. Stock restored.`,
                        user: SYSTEM_USER_ID,
                        previousQuantity,
                        newQuantity: itemDoc.quantity,
                        fromLocation: itemDoc.location || '',
                        tenantId: order.tenantId,
                    });
                    console.log(`    📝 Reversal transaction created`);
                } catch (txErr) {
                    console.log(`    ⚠️  Could not create transaction log: ${txErr.message}`);
                }
            }

            // 5. Delete the dispatch record
            await Dispatch.deleteOne({ _id: dispatch._id });
            console.log(`  🗑️  Dispatch ${dispatch.dispatchNumber} deleted`);
        }

        // 6. Clear batchAllocations on order line items and reset status
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                item.batchAllocations = [];
            });
        }
        order.status = 'confirmed';
        await order.save();

        console.log(`\n  ✅ Order #${orderNumber} → status set to 'confirmed'`);
    }

    console.log('\n\n==========================================');
    console.log('✅ All done! Disconnecting...');
    await conn.close();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Script failed:', err);
    if (conn) conn.close().catch(() => {});
    process.exit(1);
});
