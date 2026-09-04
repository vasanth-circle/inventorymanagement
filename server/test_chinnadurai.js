import mongoose from 'mongoose';
import { appConn } from './config/db.js';
import Customer from './models/Customer.js';
import CustomerLedger from './models/CustomerLedger.js';
import SalesOrder from './models/SalesOrder.js';

async function test() {
    await appConn;
    const c = await Customer.findOne({ name: "CHINNADURAI SELVARAJ" });
    console.log("Customer:", c.name, "Opening Balance:", c.openingBalance);
    
    const entries = await CustomerLedger.find({ customer: c._id }).sort({ date: 1, createdAt: 1 });
    for (const e of entries) {
        console.log(`Type: ${e.type}, Debit: ${e.debit}, Credit: ${e.credit}, Balance: ${e.balance}`);
    }
    
    const orders = await SalesOrder.find({ customer: c._id });
    for (const o of orders) {
        console.log(`Order ${o.orderNumber} by SP ${o.user}: Total ${o.totalAmount}, OldBalance ${o.oldBalance}`);
    }
    process.exit(0);
}
test();
