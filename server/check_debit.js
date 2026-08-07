import mongoose from 'mongoose';
import SalesOrder from './models/SalesOrder.js';
import CustomerLedger from './models/CustomerLedger.js';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const today = new Date('2026-08-07');
        const orders = await SalesOrder.find({
            createdAt: { $gte: today }
        }).populate('customer');
        for (const o of orders) {
            const ledgers = await CustomerLedger.find({ refId: o._id });
            if (ledgers.length > 0) {
                console.log(`Order ${o.orderNumber}: Ledger Date: ${ledgers[0].date}, Debit: ${ledgers[0].debit}, Credit: ${ledgers[0].credit}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
