import mongoose from 'mongoose';
import SalesOrder from './models/SalesOrder.js';
import { syncSalesOrderLedger } from './controllers/salesOrderController.js';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const orders = await SalesOrder.find({ isEstimation: false, status: { $nin: ['cancelled', 'void'] } });
        console.log(`Found ${orders.length} orders. Syncing ledgers...`);
        let count = 0;
        for (const order of orders) {
            if (order.customer) {
                await syncSalesOrderLedger(order._id, order.tenantId, order.user);
                count++;
            }
        }
        console.log(`Synced ${count} orders successfully.`);
    } catch (err) {
        console.error('Error during script execution:', err);
    } finally {
        process.exit(0);
    }
}
check();
