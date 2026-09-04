import mongoose from 'mongoose';
import { appConn } from './config/db.js';
import Customer from './models/Customer.js';
import CustomerLedger from './models/CustomerLedger.js';
import SalesOrder from './models/SalesOrder.js';

async function test() {
    await appConn;
    
    // Find a tenant
    const customer = await Customer.findOne({ openingBalance: { $gt: 0 } });
    const tenantId = customer.tenantId;

    // Simulate getCustomerOutstandingSummary exactly as in the controller
    const query = { isActive: true, tenantId };
    
    // Pick a user (sales person)
    const salesOrders = await SalesOrder.find({ tenantId });
    const spId = salesOrders[0].user;
    
    console.log("Filtering by SalesPerson ID:", spId);
    
    const spOrders = await SalesOrder.find({ user: spId, tenantId }).select('customer');
    const customerIds = spOrders.map(so => so.customer);
    query._id = { $in: customerIds };
    
    const customers = await Customer.find(query).sort({ name: 1 });
    
    for (const c of customers) {
        if (c.openingBalance > 0) {
            const baseQuery = { customer: c._id, tenantId };
            const allEntries = await CustomerLedger.find(baseQuery).sort({ date: 1, createdAt: 1 });
            
            // Check if there are bills from OTHER sales persons
            const cOrders = await SalesOrder.find({ customer: c._id, tenantId });
            const otherSpOrders = cOrders.filter(o => o.user.toString() !== spId.toString());
            
            if (otherSpOrders.length > 0) {
                console.log(`\nCustomer ${c.name} (Opening Bal: ${c.openingBalance}) has bills from OTHER sales persons too!`);
                console.log(`Total bills: ${cOrders.length}. Bills from selected SP: ${cOrders.length - otherSpOrders.length}`);
                
                const lastEntry = allEntries.length > 0 ? allEntries[allEntries.length - 1] : null;
                const closingBalance = lastEntry ? lastEntry.balance : c.openingBalance;
                
                console.log(`Report Closing Balance: ${closingBalance}`);
                
                // Let's manually calculate just the selected SP's bills + opening balance
                const selectedSpBills = cOrders.filter(o => o.user.toString() === spId.toString());
                const spBilledAmount = selectedSpBills.reduce((sum, o) => sum + o.totalAmount, 0);
                console.log(`Selected SP Billed Amount: ${spBilledAmount}`);
                console.log(`Selected SP Billed + Opening: ${spBilledAmount + c.openingBalance}`);
                break; // Just show one example
            }
        }
    }
    
    process.exit(0);
}
test();
