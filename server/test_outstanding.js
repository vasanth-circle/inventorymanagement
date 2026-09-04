import mongoose from 'mongoose';
import { appConn } from './config/db.js';
import Customer from './models/Customer.js';
import CustomerLedger from './models/CustomerLedger.js';
import SalesOrder from './models/SalesOrder.js';

async function test() {
    await appConn;
    const customers = await Customer.find({});
    console.log("Customers:", customers.length);
    for (const c of customers) {
        if (c.openingBalance > 0) {
            console.log(c.name, c.openingBalance);
            const ledger = await CustomerLedger.find({customer: c._id});
            console.log("Ledger length:", ledger.length);
        }
    }
    process.exit(0);
}
test();
