import mongoose from 'mongoose';
import { appConn } from './config/db.js';
import Customer from './models/Customer.js';
import CustomerLedger from './models/CustomerLedger.js';

async function test() {
    await appConn;
    const customers = await Customer.find({});
    let mismatchCount = 0;
    for (const c of customers) {
        if (c.openingBalance > 0) {
            const entries = await CustomerLedger.find({customer: c._id}).sort({ date: 1, createdAt: 1 });
            if (entries.length > 0) {
                const lastEntry = entries[entries.length - 1];
                let expectedBalance = c.openingBalance;
                for (const e of entries) expectedBalance += (e.debit || 0) - (e.credit || 0);
                if (lastEntry.balance !== expectedBalance) {
                    console.log(`Mismatch for ${c.name}: lastEntry.balance = ${lastEntry.balance}, expected = ${expectedBalance}`);
                    mismatchCount++;
                }
            }
        }
    }
    console.log(`Found ${mismatchCount} mismatches.`);
    process.exit(0);
}
test();
