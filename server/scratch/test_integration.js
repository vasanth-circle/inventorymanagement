import mongoose from 'mongoose';
import dotenv from 'dotenv';
import db from '../config/db.js';
import SalesOrder from '../models/SalesOrder.js';
import CustomerLedger from '../models/CustomerLedger.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
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

        const tenantId = new mongoose.Types.ObjectId('699ffa693090de400b207700');
        const userId = new mongoose.Types.ObjectId('699ffa693090de400b207705');

        // Delete existing mock customers and ledgers/orders just in case
        console.log('Cleaning up preexisting mock records...');
        await Customer.deleteMany({ name: { $in: ['Integration Test Customer A', 'Integration Test Customer B'] }, tenantId });
        await SalesOrder.deleteMany({ orderNumber: 'TEST-101', tenantId });

        console.log('\nCreating mock Customers...');
        const customerA = await Customer.create({
            tenantId,
            name: 'Integration Test Customer A',
            phone: '1234567890',
            openingBalance: 1000
        });
        const customerB = await Customer.create({
            tenantId,
            name: 'Integration Test Customer B',
            phone: '0987654321',
            openingBalance: 5000
        });

        console.log(`Customer A created: ${customerA._id}`);
        console.log(`Customer B created: ${customerB._id}`);

        console.log('\nFetching or creating mock Item...');
        let item = await Item.findOne({ tenantId });
        if (!item) {
            item = await Item.create({
                tenantId,
                name: 'Test Product',
                quantity: 100,
                price: 500,
                purchasePrice: 400,
                unit: 'Units'
            });
        }
        console.log(`Using Item: ${item._id} (${item.name})`);

        // Clean up customer balances using recalculate just to start clean
        await recalculateCustomerBalance(customerA._id, tenantId);
        await recalculateCustomerBalance(customerB._id, tenantId);

        console.log('\n--- STEP 1: Create Sales Order as Estimation / Quotation ---');
        const order = await SalesOrder.create({
            orderNumber: 'TEST-101',
            customer: customerA._id,
            items: [{ item: item._id, name: 'Test Product', quantity: 1, price: 500, total: 500 }],
            totalAmount: 500,
            isEstimation: true,
            status: 'quotation',
            tenantId,
            user: userId
        });
        console.log(`Order TEST-101 created (isEstimation: true)`);
        await syncSalesOrderLedger(order._id, tenantId, userId);

        let ledgerEntry = await CustomerLedger.findOne({ refId: order._id });
        console.log(`Ledger entry exists? ${!!ledgerEntry} (Expected: false)`);

        console.log('\n--- STEP 2: Edit Order to be a Final Bill (isEstimation: false) ---');
        order.isEstimation = false;
        order.status = 'confirmed';
        order.items = [{ item: item._id, name: 'Test Product', quantity: 5, price: 500, total: 2500 }]; // Set price*qty = 2500
        await order.save();
        console.log(`Order edited: isEstimation: false, status: confirmed, amount: ₹${order.totalAmount}`);
        await syncSalesOrderLedger(order._id, tenantId, userId);

        let billEntry = await CustomerLedger.findOne({ refId: order._id, type: 'bill' });
        console.log(`Bill entry exists? ${!!billEntry} (Expected: true)`);
        if (billEntry) {
            console.log(`Bill entry Details -> Ref: ${billEntry.refNumber}, Debit: ₹${billEntry.debit}, Credit: ₹${billEntry.credit}, Running Balance: ₹${billEntry.balance}`);
        }
        
        let custA = await Customer.findById(customerA._id);
        console.log(`Customer A current balance: ₹${custA.currentBalance} (Expected: ₹3500 [1000 + 2500])`);

        console.log('\n--- STEP 2.5: Add Advance Payment to the Order (₹500 advance) ---');
        order.advanceAmount = 500;
        await order.save();
        console.log(`Order updated with ₹500 advance payment. Net totalAmount: ₹${order.totalAmount}`);
        await syncSalesOrderLedger(order._id, tenantId, userId);

        billEntry = await CustomerLedger.findOne({ refId: order._id, type: 'bill' });
        let paymentEntry = await CustomerLedger.findOne({ refId: order._id, type: 'payment' });
        console.log(`Bill entry debit (Full amount): ₹${billEntry?.debit} (Expected: ₹2500)`);
        console.log(`Payment entry credit (Advance): ₹${paymentEntry?.credit} (Expected: ₹500)`);
        custA = await Customer.findById(customerA._id);
        console.log(`Customer A current balance after advance: ₹${custA.currentBalance} (Expected: ₹3000 [1000 + 2500 - 500])`);

        console.log('\n--- STEP 3: Edit Order Amount (change total items price to ₹4000, keep ₹500 advance) ---');
        order.items = [{ item: item._id, name: 'Test Product', quantity: 8, price: 500, total: 4000 }]; // Set price*qty = 4000
        await order.save();
        console.log(`Order items updated to ₹4000. Net totalAmount: ₹${order.totalAmount}`);
        await syncSalesOrderLedger(order._id, tenantId, userId);

        billEntry = await CustomerLedger.findOne({ refId: order._id, type: 'bill' });
        paymentEntry = await CustomerLedger.findOne({ refId: order._id, type: 'payment' });
        console.log(`Bill entry Debit: ₹${billEntry?.debit} (Expected: ₹4000)`);
        console.log(`Payment entry Credit: ₹${paymentEntry?.credit} (Expected: ₹500)`);
        custA = await Customer.findById(customerA._id);
        console.log(`Customer A current balance: ₹${custA.currentBalance} (Expected: ₹4500 [1000 + 4000 - 500])`);

        console.log('\n--- STEP 4: Change Order Customer (Move from Customer A to Customer B, amount ₹3000, ₹500 advance) ---');
        order.customer = customerB._id;
        order.items = [{ item: item._id, name: 'Test Product', quantity: 6, price: 500, total: 3000 }]; // Set price*qty = 3000
        await order.save();
        console.log(`Order customer changed to Customer B. Net totalAmount: ₹${order.totalAmount}`);
        await syncSalesOrderLedger(order._id, tenantId, userId);

        billEntry = await CustomerLedger.findOne({ refId: order._id, type: 'bill' });
        paymentEntry = await CustomerLedger.findOne({ refId: order._id, type: 'payment' });
        console.log(`Bill entry belongs to Customer B? ${billEntry?.customer.toString() === customerB._id.toString()}`);
        console.log(`Payment entry belongs to Customer B? ${paymentEntry?.customer.toString() === customerB._id.toString()}`);
        console.log(`Bill entry Debit: ₹${billEntry?.debit}, Payment entry Credit: ₹${paymentEntry?.credit}`);
        
        custA = await Customer.findById(customerA._id);
        let custB = await Customer.findById(customerB._id);
        console.log(`Customer A balance: ₹${custA.currentBalance} (Expected: ₹1000 [no orders left])`);
        console.log(`Customer B balance: ₹${custB.currentBalance} (Expected: ₹7500 [5000 + 3000 - 500])`);

        console.log('\n--- STEP 5: Cancel the Order (status: cancelled) ---');
        order.status = 'cancelled';
        await order.save();
        console.log(`Order status updated to cancelled`);
        await syncSalesOrderLedger(order._id, tenantId, userId);

        billEntry = await CustomerLedger.findOne({ refId: order._id, type: 'bill' });
        paymentEntry = await CustomerLedger.findOne({ refId: order._id, type: 'payment' });
        console.log(`Bill entry still exists? ${!!billEntry} (Expected: false)`);
        console.log(`Payment entry still exists? ${!!paymentEntry} (Expected: false)`);
        
        custA = await Customer.findById(customerA._id);
        custB = await Customer.findById(customerB._id);
        console.log(`Customer A balance: ₹${custA.currentBalance} (Expected: ₹1000)`);
        console.log(`Customer B balance: ₹${custB.currentBalance} (Expected: ₹5000)`);

        console.log('\n--- CLEANUP MOCK RECORDS ---');
        await SalesOrder.deleteOne({ _id: order._id });
        await CustomerLedger.deleteMany({ customer: { $in: [customerA._id, customerB._id] } });
        await Customer.deleteOne({ _id: customerA._id });
        await Customer.deleteOne({ _id: customerB._id });
        console.log('Cleanup finished.');

        console.log('\nALL INTEGRATION TESTS PASSED!');
        process.exit(0);
    } catch (err) {
        console.error('Integration test failed:', err);
        process.exit(1);
    }
}

run();
