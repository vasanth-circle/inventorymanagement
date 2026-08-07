import mongoose from 'mongoose';
import SalesOrder from './models/SalesOrder.js';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const order157 = await SalesOrder.findOne({ orderNumber: '157' });
        console.log('Order 157 total:', order157.totalAmount);
        console.log('Order 157 advance:', order157.advanceAmount);
        console.log('Order 157 oldBalance:', order157.oldBalance);
        
        const billDebitAmount = order157.totalAmount + (order157.advanceAmount || 0) - (order157.oldBalance || 0);
        console.log('Calculated billDebitAmount:', billDebitAmount);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
