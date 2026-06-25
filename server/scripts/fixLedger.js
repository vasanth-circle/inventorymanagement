/**
 * One-time fix script: recalculate ledger debit amounts for all invoices
 * that incorrectly included oldBalance in the bill entry.
 *
 * Run: node --experimental-vm-modules scripts/fixLedger.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// ── Minimal inline models ──────────────────────────────────────────────────
const salesOrderSchema = new mongoose.Schema({}, { strict: false });
const customerLedgerSchema = new mongoose.Schema({}, { strict: false });
const customerSchema = new mongoose.Schema({}, { strict: false });

const SalesOrder = mongoose.model('SalesOrder', salesOrderSchema);
const CustomerLedger = mongoose.model('CustomerLedger', customerLedgerSchema);
const Customer = mongoose.model('Customer', customerSchema);

async function recalcCustomer(customerId, tenantId) {
    const customer = await Customer.findById(customerId);
    if (!customer) return;
    const entries = await CustomerLedger.find({ customer: customerId, tenantId })
        .sort({ date: 1, createdAt: 1 });
    let balance = customer.openingBalance || 0;
    for (const entry of entries) {
        balance = balance + (entry.debit || 0) - (entry.credit || 0);
        entry.balance = balance;
        await entry.save();
    }
    await Customer.findByIdAndUpdate(customerId, { currentBalance: balance });
    console.log(`  ✔ Customer ${customerId} balance recalculated: ₹${balance}`);
}

async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!\n');

    // Get all real (non-estimation) invoices
    const orders = await SalesOrder.find({ isEstimation: false });
    console.log(`Found ${orders.length} invoices to check.\n`);

    let fixed = 0;
    const affectedCustomers = new Set();

    for (const order of orders) {
        const totalAmount = order.totalAmount || 0;
        const advance = order.advanceAmount || 0;
        const oldBalance = order.oldBalance || 0;

        // Correct bill debit = totalAmount + advance - oldBalance
        const correctDebit = totalAmount + advance - oldBalance;

        const billEntry = await CustomerLedger.findOne({
            refId: order._id,
            refType: 'SalesOrder',
            type: 'bill'
        });

        if (billEntry && Math.abs(billEntry.debit - correctDebit) > 0.01) {
            console.log(`  Order #${order.orderNumber}: debit was ₹${billEntry.debit}, should be ₹${correctDebit} (fixing...)`);
            billEntry.debit = correctDebit;
            await billEntry.save();
            fixed++;
            if (order.customer) affectedCustomers.add(order.customer.toString() + '|' + order.tenantId);
        }
    }

    console.log(`\nFixed ${fixed} ledger entries. Recalculating balances...\n`);

    for (const key of affectedCustomers) {
        const [customerId, tenantId] = key.split('|');
        await recalcCustomer(customerId, tenantId);
    }

    console.log('\n✅ Done! All ledger entries corrected.');
    await mongoose.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
