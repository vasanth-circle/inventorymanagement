import { appConn } from './config/db.js';
import Transaction from './models/Transaction.js';
import CustomerLedger from './models/CustomerLedger.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const ledgers = await CustomerLedger.find({ refNumber: '157', customer: '6a4e30742a9ec3679d8bc393' });
    console.log("Ledger entries for ref 157:", JSON.stringify(ledgers, null, 2));

    const txs = await Transaction.find({ referenceOrder: '157', customer: '6a4e30742a9ec3679d8bc393' }).populate('item');
    console.log("Transactions for ref 157:", JSON.stringify(txs, null, 2));
    
    process.exit(0);
}

check();
