import { appConn } from './config/db.js';
import CustomerLedger from './models/CustomerLedger.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const l = await CustomerLedger.find({ credit: 756 });
    console.log(JSON.stringify(l, null, 2));
}
check().finally(() => process.exit());
