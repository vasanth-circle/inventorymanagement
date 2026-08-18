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

async function main() {
    console.log('\n🧹 Recalculating ALL Customer Balances');
    console.log('=====================================================');

    conn = await mongoose.createConnection(MONGO_URI, { family: 4 }).asPromise();
    console.log('✅ Connected to MongoDB\n');

    const CustomerLedger = conn.model('CustomerLedger', genericSchema);
    const Customer       = conn.model('Customer', genericSchema);

    const customers = await Customer.find({});

    let count = 0;
    for (const customer of customers) {
        const entries = await CustomerLedger.find({ customer: customer._id, tenantId: customer.tenantId })
            .sort({ date: 1, createdAt: 1 });

        let runningBalance = customer.openingBalance || 0;
        for (const entry of entries) {
            runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0);
            if (entry.balance !== runningBalance) {
                await CustomerLedger.updateOne({ _id: entry._id }, { $set: { balance: runningBalance } });
            }
        }

        await Customer.findByIdAndUpdate(customer._id, { currentBalance: runningBalance });
        console.log(`  ✅ ${customer.companyName || customer.name} | Final balance: ₹${runningBalance.toFixed(2)}`);
        count++;
    }

    console.log(`\n✅ Done! Recalculated ${count} customer balance(s).`);
    await conn.close();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Script failed:', err);
    if (conn) conn.close().catch(() => {});
    process.exit(1);
});
