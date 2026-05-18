import mongoose from 'mongoose';
import dotenv from 'dotenv';
import db from '../config/db.js';
import SalesOrder from '../models/SalesOrder.js';
import { createBillLedgerEntry } from '../controllers/salesOrderController.js';

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

        console.log('Fetching order E-1...');
        const order = await SalesOrder.findOne({ orderNumber: 'E-1' });
        if (!order) {
            console.log('Order not found');
            process.exit(1);
        }

        console.log('Simulating createBillLedgerEntry...');
        // Let's call the actual helper function
        await createBillLedgerEntry({
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerId: order.customer,
            amount: order.totalAmount,
            tenantId: order.tenantId,
            userId: order.user,
            orderDate: order.orderDate,
        });

        console.log('Helper call finished without throwing unhandled exceptions. Checking if ledger was created...');
        
        // Let's query the ledger
        const CustomerLedger = (await import('../models/CustomerLedger.js')).default;
        const entry = await CustomerLedger.findOne({ refId: order._id });
        if (entry) {
            console.log('SUCCESS! Ledger entry was created successfully:', entry);
        } else {
            console.log('FAILED! No ledger entry exists for this order after calling the helper!');
        }

        process.exit(0);
    } catch (err) {
        console.error('Unhandled script error:', err);
        process.exit(1);
    }
}

run();
