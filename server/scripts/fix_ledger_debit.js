/**
 * fix_ledger_debit.js
 * 
 * Fixes existing CustomerLedger 'bill' entries that were created via the
 * quotation-conversion path (quotationController.js). That path incorrectly used:
 *   debit = salesOrder.totalAmount + advanceAmount
 * which included oldBalance twice. The correct formula is:
 *   debit = salesOrder.totalAmount + advanceAmount - oldBalance
 *
 * This script re-syncs every non-estimation SalesOrder through syncSalesOrderLedger
 * and then recalculates all customer running balances.
 *
 * Run with:
 *   node --experimental-vm-modules scripts/fix_ledger_debit.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ── Import models and helpers ──────────────────────────────────────────────────
import SalesOrder from '../models/SalesOrder.js';
import Customer from '../models/Customer.js';
import CustomerLedger from '../models/CustomerLedger.js';
import { syncSalesOrderLedger } from '../controllers/salesOrderController.js';

async function main() {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // ── Step 1: Re-sync every real (non-estimation) invoice ──────────────────
    const orders = await SalesOrder.find({ isEstimation: false }).select('_id orderNumber customer tenantId');
    console.log(`\nFound ${orders.length} invoice(s) to re-sync...`);

    for (const order of orders) {
        try {
            await syncSalesOrderLedger(order._id, order.tenantId, null);
            console.log(`  ✔ Re-synced order #${order.orderNumber}`);
        } catch (err) {
            console.error(`  ✘ Error syncing order #${order.orderNumber}:`, err.message);
        }
    }

    // ── Step 2: Recalculate running balance for every customer ──────────────
    const customers = await Customer.find({}).select('_id openingBalance tenantId');
    console.log(`\nRecalculating balances for ${customers.length} customer(s)...`);

    for (const customer of customers) {
        try {
            const entries = await CustomerLedger.find({
                customer: customer._id,
                tenantId: customer.tenantId
            }).sort({ date: 1, createdAt: 1 });

            let running = customer.openingBalance || 0;
            for (const entry of entries) {
                running = running + (entry.debit || 0) - (entry.credit || 0);
                entry.balance = running;
                await entry.save();
            }

            await Customer.findByIdAndUpdate(customer._id, { currentBalance: running });
            console.log(`  ✔ Customer ${customer._id} → final balance: ₹${running.toFixed(2)}`);
        } catch (err) {
            console.error(`  ✘ Error recalculating customer ${customer._id}:`, err.message);
        }
    }

    console.log('\n🎉 Done! All ledger entries and balances have been corrected.');
    await mongoose.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
