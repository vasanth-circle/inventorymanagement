import mongoose from 'mongoose';
import { appConn } from './config/db.js';
import Customer from './models/Customer.js';
import CustomerLedger from './models/CustomerLedger.js';
import SalesOrder from './models/SalesOrder.js';

async function test() {
    await appConn;
    const customer = await Customer.findOne({ name: /AATHIRA BUILDERS/i });
    if (!customer) return console.log("Not found");
    
    console.log("AATHIRA BUILDERS");
    console.log("Opening Balance:", customer.openingBalance);
    console.log("Current Balance:", customer.currentBalance);
    
    const entries = await CustomerLedger.find({customer: customer._id}).sort({ date: 1, createdAt: 1 });
    console.log("Ledger entries count:", entries.length);
    for (const e of entries) {
        console.log(`Date: ${e.date}, Type: ${e.type}, Debit: ${e.debit}, Credit: ${e.credit}, Balance: ${e.balance}`);
    }
    process.exit(0);
}
test();
