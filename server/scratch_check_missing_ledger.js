import { appConn } from './config/db.js';
import Transaction from './models/Transaction.js';
import CustomerLedger from './models/CustomerLedger.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const txs = await Transaction.find({ type: 'return', referenceOrder: '157' });
    console.log(`Found ${txs.length} return transactions for ref 157`);
    
    for (const tx of txs) {
        const ledger = await CustomerLedger.findOne({ refId: tx._id });
        console.log(`Tx ${tx._id} (Qty: ${tx.quantity}, Total: ${tx.total}): Ledger exists? ${!!ledger}`);
    }
}
check().finally(() => process.exit());
