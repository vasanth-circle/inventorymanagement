import mongoose from 'mongoose';
import db from '../config/db.js';
import Transaction from '../models/Transaction.js';
import Item from '../models/Item.js';
import CustomerLedger from '../models/CustomerLedger.js';
import VendorLedger from '../models/VendorLedger.js';
import Customer from '../models/Customer.js';
import Vendor from '../models/Vendor.js';

const run = async () => {
    try {
        console.log('Connected to DB via pool');

        const returns = await Transaction.find({ type: 'return' }).populate('item');
        console.log(`Found ${returns.length} total return transactions.`);

        let fixedCount = 0;

        for (const tx of returns) {
            const item = tx.item;
            if (!item) continue;

            // Check if item is a tile
            const isTile = item.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((item.unitType || '').toLowerCase());
            
            let actualTotal = 0;
            if (isTile) {
                // tx.quantity is in pieces (after my previous script)
                const totalSqFt = tx.quantity * item.sqFtPerPc;
                actualTotal = totalSqFt * tx.rate;
            } else {
                actualTotal = tx.quantity * tx.rate;
            }

            // Always save tx.total
            tx.total = actualTotal;
            await tx.save();

            // Find the ledger entry that matches this transaction and update its amount.
            // Since we previously updated the ledger to `tx.quantity * tx.rate` (which was pieces * rate), we need to update it again!
            // Wait, we don't know the exact previous amount. The safest way is to find the ledger entry by date and refNumber.
            // Actually, we know the previous amount was exactly `tx.quantity * tx.rate`!
            const oldTotal = tx.quantity * tx.rate;
            
            if (tx.returnType === 'customer' && tx.customer) {
                const ledgers = await CustomerLedger.find({ 
                    customer: tx.customer, 
                    type: 'payment',
                    refType: 'Manual',
                    credit: oldTotal 
                }).sort({ createdAt: -1 });

                if (ledgers.length > 0) {
                    const ledger = ledgers[0];
                    ledger.credit = actualTotal;
                    await ledger.save();
                    console.log(`Fixed customer ledger ${ledger._id} from ${oldTotal} to ${actualTotal}`);
                }
            } else if (tx.returnType === 'vendor' && tx.vendor) {
                const ledgers = await VendorLedger.find({ 
                    vendor: tx.vendor, 
                    type: 'adjustment',
                    refType: 'Manual',
                    debit: oldTotal 
                }).sort({ createdAt: -1 });

                if (ledgers.length > 0) {
                    const ledger = ledgers[0];
                    ledger.debit = actualTotal;
                    await ledger.save();
                    console.log(`Fixed vendor ledger ${ledger._id} from ${oldTotal} to ${actualTotal}`);
                }
            }
            fixedCount++;
        }

        console.log(`Successfully updated total on ${fixedCount} return transactions.`);
        
        console.log('Recalculating all ledger balances...');
        
        const customers = await CustomerLedger.distinct('customer');
        for (const c of customers) {
            const entries = await CustomerLedger.find({ customer: c }).sort({ date: 1, createdAt: 1 });
            let balance = 0;
            const cust = await Customer.findById(c);
            balance = cust?.openingBalance || 0;
            for (const e of entries) {
                balance = balance + (e.debit || 0) - (e.credit || 0);
                e.balance = balance;
                await e.save();
            }
            if (cust) {
                cust.currentBalance = balance;
                await cust.save();
            }
        }

        const vendors = await VendorLedger.distinct('vendor');
        for (const v of vendors) {
            const entries = await VendorLedger.find({ vendor: v }).sort({ date: 1, createdAt: 1 });
            let balance = 0;
            const vend = await Vendor.findById(v);
            balance = vend?.openingBalance || 0;
            for (const e of entries) {
                balance = balance + (e.credit || 0) - (e.debit || 0);
                e.balance = balance;
                await e.save();
            }
            if (vend) {
                vend.currentBalance = balance;
                await vend.save();
            }
        }
        
        console.log('Ledger recalculation complete.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
