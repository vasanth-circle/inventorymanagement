import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;
if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
}

const genericSchema = new mongoose.Schema({}, { strict: false });
let conn;

async function recalculateCustomerBalance(CustomerLedger, Customer, customerId, tenantId) {
    const customer = await Customer.findOne({ _id: customerId, tenantId });
    if (!customer) return { finalBalance: 0, changed: 0 };

    const entries = await CustomerLedger.find({ customer: customerId, tenantId })
        .sort({ date: 1, createdAt: 1 });

    let running = customer.openingBalance || 0;
    let changed = 0;

    for (const entry of entries) {
        running = running + (entry.credit || 0) - (entry.debit || 0);
        if (entry.balance !== running) {
            entry.balance = running;
            await entry.save();
            changed++;
        }
    }

    await Customer.findByIdAndUpdate(customerId, { currentBalance: running });
    return { finalBalance: running, changed };
}

async function main() {
    console.log('\n🧹 Fix CustomerLedger Refund Entries (Credit to Debit)');
    console.log('=====================================================');

    conn = await mongoose.createConnection(MONGO_URI, { family: 4 }).asPromise();
    console.log('✅ Connected to MongoDB\n');

    const CustomerLedger = conn.model('CustomerLedger', genericSchema);
    const Customer       = conn.model('Customer', genericSchema);

    // Find all refund entries that have credit > 0 instead of debit
    const wrongEntries = await CustomerLedger.find({
        type: 'adjustment',
        description: { $regex: /Refund/i },
        credit: { $gt: 0 }
    });

    console.log(`📋 Found ${wrongEntries.length} wrong refund entries to fix\n`);

    if (wrongEntries.length === 0) {
        console.log('✅ Nothing to fix — ledger is already clean.');
        await conn.close();
        process.exit(0);
    }

    const affectedCustomers = new Set();

    for (const entry of wrongEntries) {
        const customer = await Customer.findById(entry.customer);
        const customerName = customer?.name || customer?.companyName || String(entry.customer);
        console.log(`  🔧 Fixing ${customerName} | entry ${entry._id} | shifting ₹${entry.credit} to debit | date: ${new Date(entry.date).toISOString().slice(0, 10)}`);

        entry.debit = entry.credit;
        entry.credit = 0;
        await entry.save();

        affectedCustomers.add(`${entry.customer.toString()}::${entry.tenantId?.toString()}`);
    }

    console.log(`\n──────────────────────────────────────`);
    console.log(`🔁 Recalculating balances for ${affectedCustomers.size} customer(s)...\n`);

    for (const key of affectedCustomers) {
        const [customerId, tenantId] = key.split('::');
        const customer = await Customer.findById(customerId);
        const customerName = customer?.name || customer?.companyName || customerId;

        const result = await recalculateCustomerBalance(
            CustomerLedger, Customer,
            new mongoose.Types.ObjectId(customerId),
            tenantId && tenantId !== 'undefined' ? new mongoose.Types.ObjectId(tenantId) : undefined,
        );

        console.log(`  ✅ ${customerName} | Final balance: ₹${result.finalBalance.toFixed(2)} | Re-balanced entries: ${result.changed}`);
    }

    console.log(`\n✅ Done! Fixed ${wrongEntries.length} entries and recalculated ${affectedCustomers.size} customer balance(s).`);

    await conn.close();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Script failed:', err);
    if (conn) conn.close().catch(() => {});
    process.exit(1);
});
