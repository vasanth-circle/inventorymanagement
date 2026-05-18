import mongoose from 'mongoose';
import dotenv from 'dotenv';
import db from '../config/db.js';
import SalesOrder from '../models/SalesOrder.js';
import CustomerLedger from '../models/CustomerLedger.js';
import Customer from '../models/Customer.js';
import { syncSalesOrderLedger, recalculateCustomerBalance } from '../controllers/salesOrderController.js';

dotenv.config();

async function run() {
    try {
        console.log('Connecting to database...');
        await new Promise((resolve) => {
            if (db.appConn.readyState === 1) {
                resolve();
            } else {
                db.appConn.on('connected', resolve);
            }
        });

        console.log('Fetching all final/confirmed sales orders...');
        const orders = await SalesOrder.find({
            isEstimation: false,
            status: { $nin: ['cancelled', 'void'] }
        });

        console.log(`Found ${orders.length} final bills/orders.`);

        let backfilledCount = 0;
        let verifiedCount = 0;
        const customerIdsToRecalculate = new Set();

        for (const order of orders) {
            console.log(`[BACKFILL/SYNC] Order ${order.orderNumber} (Net: ₹${order.totalAmount}, Advance: ₹${order.advanceAmount || 0}) synchronizing ledger...`);
            await syncSalesOrderLedger(order._id, order.tenantId, order.user || null);
            backfilledCount++;
            customerIdsToRecalculate.add(order.customer.toString() + '|' + order.tenantId.toString());
        }

        // Make sure all affected customers have their balances recalculated chronologically
        console.log('\nRecalculating balances chronologically for all active customers...');
        for (const custKey of customerIdsToRecalculate) {
            const [customerId, tenantId] = custKey.split('|');
            console.log(`Recalculating for Customer: ${customerId}...`);
            await recalculateCustomerBalance(customerId, tenantId);
        }

        console.log('\n=== BACKFILL COMPLETE ===');
        console.log(`Backfilled missing ledger entries: ${backfilledCount}`);
        console.log(`Verified correct ledger entries: ${verifiedCount}`);

        // Fetch the ledger of the test customer to verify
        const testOrder = await SalesOrder.findOne({ orderNumber: 'E-1' });
        if (testOrder) {
            console.log('\nChecking ledger entries for test order E-1...');
            const entries = await CustomerLedger.find({ refId: testOrder._id });
            console.log(`Found ${entries.length} ledger entries for E-1:`);
            entries.forEach(e => {
                console.log(`- Ref: ${e.refNumber}, Type: ${e.type}, Debit: ₹${e.debit}, Credit: ₹${e.credit}, Running Balance: ₹${e.balance}`);
            });

            const customer = await Customer.findById(testOrder.customer);
            console.log(`Customer "${customer.name}" current balance in database: ₹${customer.currentBalance}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Backfill script error:', err);
        process.exit(1);
    }
}

run();
