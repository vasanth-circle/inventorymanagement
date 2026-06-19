import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import { appConn } from './config/db.js';
import Transaction from './models/Transaction.js';

async function fixRates() {
    try {
        console.log('Connecting to DB...');
        while (appConn.readyState !== 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const tx = await Transaction.findById('6a34e21c6197ee0f1aa74b0f');
        if (tx) {
            if (tx.rate === 0) {
                tx.rate = 54;
                await tx.save();
                console.log(`Updated rate to 54 for transaction ${tx._id}`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
fixRates();
