import { appConn } from './config/db.js';
import CustomerLedger from './models/CustomerLedger.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const ledgers = await CustomerLedger.find({ customer: '6a4e30742a9ec3679d8bc393' }).sort({date: 1, createdAt: 1});
    console.log("All ledger entries length:", ledgers.length);
    ledgers.forEach(l => {
        console.log(`${l.date.toISOString().split('T')[0]} | ${l.type} | ${l.refNumber} | Dr: ${l.debit} | Cr: ${l.credit} | Bal: ${l.balance}`);
    });
    process.exit(0);
}

check();
