import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import { appConn } from './config/db.js';
import Transaction from './models/Transaction.js';

async function logTxs() {
    try {
        console.log('Connecting to DB...');
        while (appConn.readyState !== 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const transactions = await Transaction.find({ type: 'return' }).sort({ createdAt: 1 });
        console.log(`Found ${transactions.length} total return transactions.`);
        
        for (const tx of transactions) {
            console.log(`ID: ${tx._id}, Item: ${tx.item}, Qty: ${tx.quantity}, Customer: ${tx.customer}, Created: ${tx.createdAt}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
logTxs();
