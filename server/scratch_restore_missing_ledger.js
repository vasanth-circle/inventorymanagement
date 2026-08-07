import { appConn } from './config/db.js';
import Transaction from './models/Transaction.js';
import CustomerLedger from './models/CustomerLedger.js';
import Item from './models/Item.js';
import dotenv from 'dotenv';
dotenv.config();

async function restore() {
    const txs = await Transaction.find({ type: 'return', referenceOrder: '157' });
    
    for (const tx of txs) {
        const ledgerWithRefId = await CustomerLedger.findOne({ refId: tx._id });
        if (!ledgerWithRefId) {
            console.log(`Restoring missing ledger for Tx ${tx._id} (Total: ${tx.total})`);
            const itemDoc = await Item.findById(tx.item);
            
            await CustomerLedger.create({
                tenantId: tx.tenantId,
                customer: tx.customer,
                date: tx.createdAt, // use transaction date to place it correctly
                type: 'payment',
                refType: 'Manual',
                refId: tx._id,
                refNumber: tx.referenceOrder || '157',
                description: `Refund (Restored): ${itemDoc ? itemDoc.name : 'Unknown'} (${tx.quantity} qty)`,
                credit: tx.total,
                balance: 0, // Will be recalculated
                createdBy: tx.user,
                notes: 'Restored missing return entry'
            });
        }
    }
}
restore().finally(() => process.exit());
