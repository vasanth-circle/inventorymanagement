import { appConn } from './config/db.js';
import CustomerLedger from './models/CustomerLedger.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const ledgers = await CustomerLedger.find({ customer: '6a4e30742a9ec3679d8bc393' }).sort({date: -1}).limit(5);
    console.log("Recent ledger entries:", JSON.stringify(ledgers, null, 2));
    process.exit(0);
}

check();
