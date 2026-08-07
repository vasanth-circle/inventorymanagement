import { appConn } from './config/db.js';
import CustomerLedger from './models/CustomerLedger.js';
import dotenv from 'dotenv';
dotenv.config();

async function recalc() {
    const customerId = '6a4e30742a9ec3679d8bc393'; // Srpk Housing
    const entries = await CustomerLedger.find({ customer: customerId }).sort({ date: 1, createdAt: 1 });
    let balance = 0;
    
    for (const entry of entries) {
        if (entry.debit) balance += entry.debit;
        if (entry.credit) balance -= entry.credit;
        entry.balance = balance;
        await entry.save();
    }
    console.log(`Recalculated ${entries.length} entries. Final balance: ${balance}`);
}
recalc().finally(() => process.exit());
