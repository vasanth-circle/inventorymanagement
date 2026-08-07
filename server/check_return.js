import mongoose from 'mongoose';
import SalesReturn from './models/SalesReturn.js';
import SalesOrder from './models/SalesOrder.js';
import CustomerLedger from './models/CustomerLedger.js';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const order157 = await SalesOrder.findOne({ orderNumber: '157' });
        const returns = await SalesReturn.find({ order: order157._id });
        console.log('Returns for 157:', returns.length);
        if (returns.length > 0) {
            console.log('Return amounts:', returns.map(r => r.totalRefundAmount));
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
