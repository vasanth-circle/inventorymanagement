import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import { appConn } from './config/db.js';
import Transaction from './models/Transaction.js';
import Item from './models/Item.js';

async function delTx() {
    try {
        console.log('Connecting to DB...');
        while (appConn.readyState !== 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const tx = await Transaction.findById('6a34e22d6197ee0f1aa74b1b');
        if (tx) {
            await Transaction.findByIdAndDelete(tx._id);
            console.log(`Deleted transaction ${tx._id}`);

            // Revert stock
            const itemDoc = await Item.findById(tx.item);
            if (itemDoc) {
                itemDoc.quantity -= tx.quantity;
                await itemDoc.save();
                console.log(`Reverted stock for item ${itemDoc.name} by ${tx.quantity}`);
            }
        } else {
            console.log('Transaction not found, might be deleted already.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
delTx();
