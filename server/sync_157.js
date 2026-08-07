import mongoose from 'mongoose';
import SalesOrder from './models/SalesOrder.js';
import { syncSalesOrderLedger } from './controllers/salesOrderController.js';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const order157 = await SalesOrder.findOne({ orderNumber: '157' });
        console.log('Syncing ledger for 157...');
        await syncSalesOrderLedger(order157._id, order157.tenantId, order157.user);
        console.log('Sync done. Checking ledgers...');
        
        const CustomerLedger = (await import('./models/CustomerLedger.js')).default;
        const ledgers = await CustomerLedger.find({ refId: order157._id });
        console.log('Ledgers:', ledgers);
    } catch (err) {
        console.error('Error during script execution:', err);
    } finally {
        process.exit(0);
    }
}
check();
