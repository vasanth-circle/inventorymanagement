import mongoose from 'mongoose';
import dotenv from 'dotenv';
import db from '../config/db.js';
import SalesOrder from '../models/SalesOrder.js';

dotenv.config();

async function run() {
    try {
        await new Promise((resolve) => {
            if (db.appConn.readyState === 1) {
                resolve();
            } else {
                db.appConn.on('connected', resolve);
            }
        });

        const order = await SalesOrder.findOne({ orderNumber: 'E-1' });
        if (order) {
            console.log(JSON.stringify(order, null, 2));
        } else {
            console.log('Order not found');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
