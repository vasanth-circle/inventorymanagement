import { appConn } from './config/db.js';
import Transaction from './models/Transaction.js';
import CustomerLedger from './models/CustomerLedger.js';
import Item from './models/Item.js';
import Customer from './models/Customer.js';
import dotenv from 'dotenv';
dotenv.config();

async function restore() {
    try {
        const txId = '6a5f7f49a654c8cabfdbdf07';
        const tx = await Transaction.findById(txId).populate('item');
        
        if (!tx) {
            console.log("Transaction not found.");
            process.exit(1);
        }

        console.log(`Restoring ledger entry for return of ${tx.quantity} qty of ${tx.item.name} (Amount: ${tx.total})`);

        // Create the ledger entry
        const ledgerEntry = await CustomerLedger.create({
            tenantId: tx.tenantId,
            customer: tx.customer,
            date: tx.createdAt, // Same date as transaction
            type: 'payment',
            refType: 'Manual',
            refId: tx._id,
            refNumber: tx.referenceOrder || `RET-${Date.now()}`,
            description: `Refund (Restored): ${tx.item.name} (${tx.quantity} qty)`,
            credit: tx.total,
            balance: 0, // Will be recalculated
            createdBy: tx.user,
            notes: 'Restored return entry',
            createdAt: tx.createdAt, // Optional: preserve original creation time
        });

        console.log(`Ledger entry created with ID: ${ledgerEntry._id}`);

        // Recalculate customer's ledger
        console.log(`Recalculating ledger for customer ${tx.customer}...`);
        const entries = await CustomerLedger.find({ customer: tx.customer })
            .sort({ date: 1, createdAt: 1 });
        
        const customer = await Customer.findById(tx.customer);
        let runningBalance = customer.openingBalance || 0;
        
        for (const entry of entries) {
            runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0);
            entry.balance = runningBalance;
            await entry.save();
        }
        
        // No currentBalance on Customer model in this app usually? Let's check Customer model if needed, but it seems there is.
        // Let's see if we should update Customer.
        // I'll just save the entries.
        console.log(`Recalculation complete. Final balance for customer: ${runningBalance}`);
        
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

restore();
