import mongoose from 'mongoose';
import CustomerLedger from './models/CustomerLedger.js';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const ledgers = await CustomerLedger.find({ refNumber: '157' });
        console.log('Ledgers with refNumber 157:', ledgers);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
