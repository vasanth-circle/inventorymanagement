import mongoose from 'mongoose';
import SalesOrder from './models/SalesOrder.js';
import CustomerLedger from './models/CustomerLedger.js';
import Customer from './models/Customer.js';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const order = await SalesOrder.findOne({ orderNumber: '282' }).populate('customer');
        if (!order) {
            console.log('Order 282 not found');
            process.exit(0);
        }
        console.log('Order 282 Status:', order.status, 'Is Estimation:', order.isEstimation);
        const ledgers = await CustomerLedger.find({ refId: order._id });
        console.log('Ledger entries for Order 282:', ledgers.length);
        console.log(ledgers);
        
        console.log('Customer balance:', order.customer?.balance);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
