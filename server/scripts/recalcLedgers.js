import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Customer from '../models/Customer.js';
import CustomerLedger from '../models/CustomerLedger.js';

async function run() {
    try {
        console.log('Fetching all customers...');
        const customers = await Customer.find({});
        console.log(`Found ${customers.length} customers.`);

        for (const customer of customers) {
            console.log(`Recalculating ledger for customer ${customer._id} - ${customer.name || customer.companyName}...`);
            const entries = await CustomerLedger.find({ customer: customer._id })
                .sort({ date: 1, createdAt: 1 });
            
            let runningBalance = customer.openingBalance || 0;
            for (const entry of entries) {
                runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0);
                entry.balance = runningBalance;
                await entry.save();
            }
            
            await Customer.findByIdAndUpdate(customer._id, { currentBalance: runningBalance });
            console.log(`  -> Final balance: ${runningBalance}`);
        }

        console.log('Done recalculating all customer ledgers.');
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
