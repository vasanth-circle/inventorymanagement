import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import { appConn } from './config/db.js';
import Transaction from './models/Transaction.js';
import CustomerLedger from './models/CustomerLedger.js';
import Item from './models/Item.js';

async function fixDuplicates() {
    try {
        console.log('Connecting to DB...');
        // Wait for connection to be ready
        while (appConn.readyState !== 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('Connected.');

        // Find all duplicate CustomerLedger entries on the same day with same description and amount
        const ledgers = await CustomerLedger.find({ type: 'payment', description: /Refunded Amt/ }).sort({ createdAt: 1 });
        
        const seen = new Set();
        const duplicates = [];

        for (const l of ledgers) {
            const key = `${l.customer.toString()}_${l.description}_${l.credit}_${new Date(l.date).toDateString()}`;
            if (seen.has(key)) {
                duplicates.push(l);
            } else {
                seen.add(key);
            }
        }

        console.log(`Found ${duplicates.length} duplicate ledger entries.`);

        for (const dup of duplicates) {
            console.log(`Deleting duplicate ledger entry: ${dup._id} - ${dup.description}`);
            await CustomerLedger.findByIdAndDelete(dup._id);
            
            // Recalculate balance for this customer after this deletion
            console.log(`Recalculating ledger balances for customer ${dup.customer}...`);
            const allCustomerLedgers = await CustomerLedger.find({ customer: dup.customer }).sort({ date: 1, createdAt: 1 });
            let balance = 0;
            for (const entry of allCustomerLedgers) {
                if (entry.debit) balance += entry.debit;
                if (entry.credit) balance -= entry.credit;
                if (entry.balance !== balance) {
                    entry.balance = balance;
                    await entry.save();
                }
            }
        }

        // Now do the same for Transactions (type: 'return')
        const transactions = await Transaction.find({ type: 'return' }).sort({ createdAt: 1 });
        const seenTx = new Set();
        const duplicateTxs = [];

        for (const tx of transactions) {
            // Find if there is a previous transaction with same item, qty, customer within 5 seconds
            let isDuplicate = false;
            for (const prev of duplicateTxs.concat(Array.from(seenTx))) {
                if (
                    prev.item.toString() === tx.item.toString() &&
                    prev.quantity === tx.quantity &&
                    prev.customer?.toString() === tx.customer?.toString() &&
                    Math.abs(new Date(tx.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 10000 // 10 seconds
                ) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (isDuplicate) {
                duplicateTxs.push(tx);
            } else {
                seenTx.add(tx);
            }
        }

        console.log(`Found ${duplicateTxs.length} duplicate return transactions.`);

        for (const dup of duplicateTxs) {
            console.log(`Deleting duplicate transaction: ${dup._id}`);
            await Transaction.findByIdAndDelete(dup._id);

            // Revert the item stock that was added by the duplicate return
            if (dup.returnType === 'customer') {
                const itemDoc = await Item.findById(dup.item);
                if (itemDoc) {
                    itemDoc.quantity -= dup.quantity;
                    await itemDoc.save();
                    console.log(`Reverted ${dup.quantity} stock for item ${itemDoc.name}`);
                }
            } else if (dup.returnType === 'vendor') {
                const itemDoc = await Item.findById(dup.item);
                if (itemDoc) {
                    itemDoc.quantity += dup.quantity;
                    await itemDoc.save();
                }
            }
        }

        console.log('Fix complete.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixDuplicates();
