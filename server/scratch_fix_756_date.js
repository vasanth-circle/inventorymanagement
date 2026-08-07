import { appConn } from './config/db.js';
import CustomerLedger from './models/CustomerLedger.js';
import dotenv from 'dotenv';
dotenv.config();

async function fix() {
    const l = await CustomerLedger.findOne({ credit: 756, refNumber: '157' });
    if (l) {
        console.log(`Found entry: ${l._id} with date ${l.date}`);
        l.date = new Date('2026-07-21T00:00:00.000Z'); // The date of the other 157 entries
        await l.save();
        console.log(`Updated date to ${l.date}`);
    } else {
        console.log('Not found');
    }
}
fix().finally(() => process.exit());
