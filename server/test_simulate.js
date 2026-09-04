import mongoose from 'mongoose';
import { appConn } from './config/db.js';
import Customer from './models/Customer.js';
import CustomerLedger from './models/CustomerLedger.js';
import SalesOrder from './models/SalesOrder.js';
import User from './models/User.js';

async function test() {
    await appConn;
    const aathira = await Customer.findOne({ name: /AATHIRA BUILDERS/i });
    if (!aathira) return console.log("Not found");
    
    // find a sales person
    const users = await User.find({});
    
    for (const u of users) {
        const salesOrders = await SalesOrder.find({ user: u._id }).select('customer');
        const customerIds = salesOrders.map(so => so.customer.toString());
        if (customerIds.includes(aathira._id.toString())) {
            console.log(`User ${u.name} has AATHIRA BUILDERS`);
        }
    }
    
    // Let's simulate the getCustomerOutstandingSummary exactly as in the controller
    const query = { isActive: true };
    // let's pick a user ID that has AATHIRA BUILDERS
    const salesOrders = await SalesOrder.find({ customer: aathira._id });
    if (salesOrders.length > 0) {
        const spId = salesOrders[0].user;
        console.log("SalesPerson ID:", spId);
        
        const spOrders = await SalesOrder.find({ user: spId }).select('customer');
        const cIds = spOrders.map(so => so.customer);
        query._id = { $in: cIds };
        
        const customers = await Customer.find(query).sort({ name: 1 });
        console.log(`Found ${customers.length} customers for this sales person`);
        
        for (const customer of customers) {
            if (customer.name === aathira.name) {
                const baseQuery = { customer: customer._id };
                const openBal = customer.openingBalance || 0;
                const allEntries = await CustomerLedger.find(baseQuery).sort({ date: 1, createdAt: 1 });
                const ledgerDebit  = allEntries.reduce((s, e) => s + (e.debit  || 0), 0);
                const ledgerCredit = allEntries.reduce((s, e) => s + (e.credit || 0), 0);
                const totalDebit  = ledgerDebit  + (openBal > 0 ? openBal : 0);
                const totalCredit = ledgerCredit + (openBal < 0 ? Math.abs(openBal) : 0);
                const lastEntry = allEntries.length > 0 ? allEntries[allEntries.length - 1] : null;
                const closingBalance = lastEntry ? lastEntry.balance : openBal;
                console.log(`Simulated output for ${customer.name}:`);
                console.log(`totalDebit: ${totalDebit}, closingBalance: ${closingBalance}`);
            }
        }
    }
    process.exit(0);
}
test();
