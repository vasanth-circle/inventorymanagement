import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from '../models/Customer.js';
import CustomerLedger from '../models/CustomerLedger.js';
import { recalculateCustomerBalance } from './salesOrderController.js';
import { appConn } from '../config/db.js';

dotenv.config();

const run = async () => {
    try {
        await appConn.asPromise();
        console.log('Connected to DB');
        
        const customers = await Customer.find({});
        console.log(`Found ${customers.length} customers to recalculate`);
        
        for (const customer of customers) {
            console.log(`Recalculating ledger for customer ${customer.name} (${customer._id})`);
            await recalculateCustomerBalance(customer._id, customer.tenantId);
        }
        
        console.log('Finished recalculating all customers');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
