import mongoose from 'mongoose';
import SalesOrder from './models/SalesOrder.js';
import CustomerLedger from './models/CustomerLedger.js';
import Customer from './models/Customer.js';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const today = new Date('2026-08-07');
        const orders = await SalesOrder.find({
            createdAt: { $gte: today }
        }).populate('customer');
        console.log(`Orders created today (${orders.length}):`);
        for (const o of orders) {
            console.log(`Order ${o.orderNumber} for ${o.customer?.name} - isEstimation: ${o.isEstimation}, status: ${o.status}, orderDate: ${o.orderDate}`);
            const ledgers = await CustomerLedger.find({ refId: o._id });
            console.log(`  Ledgers for ${o.orderNumber}: ${ledgers.length}`);
            if (ledgers.length > 0) {
                console.log(`  Ledger Date: ${ledgers[0].date}, type: ${ledgers[0].type}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
