import { appConn } from './config/db.js';
import Customer from './models/Customer.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const customer = await Customer.findById('6a4e30742a9ec3679d8bc393');
    console.log("Customer opening balance:", customer.openingBalance);
    process.exit(0);
}

check();
