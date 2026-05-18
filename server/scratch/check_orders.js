import mongoose from 'mongoose';
import dotenv from 'dotenv';
import db from '../config/db.js';
import SalesOrder from '../models/SalesOrder.js';
import Dispatch from '../models/Dispatch.js';
import User from '../models/User.js';

dotenv.config();

async function run() {
    try {
        console.log('Connecting to database...');
        await new Promise((resolve) => {
            if (db.appConn.readyState === 1) {
                resolve();
            } else {
                db.appConn.on('connected', resolve);
            }
        });

        console.log('Fetching order E-1...');
        const order = await SalesOrder.findOne({ orderNumber: 'E-1' });
        if (!order) {
            console.log('Order E-1 not found!');
        } else {
            console.log('=== ORDER INFO ===');
            console.log('ID:', order._id);
            console.log('Order Number:', order.orderNumber);
            console.log('Status:', order.status);
            console.log('isEstimation:', order.isEstimation);
            console.log('Total Amount:', order.totalAmount);

            console.log('\nFetching dispatches for E-1...');
            const dispatches = await Dispatch.find({ order: order._id }).populate({ path: 'createdBy', model: User, select: 'name' });
            console.log(`Found ${dispatches.length} dispatches.`);
            dispatches.forEach(d => {
                console.log(`- Dispatch Number: ${d.dispatchNumber}, Vehicle: ${d.vehicleNumber}, Created By: ${d.createdBy?.name || 'N/A'}, Created At: ${d.createdAt}`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error('Error running script:', err);
        process.exit(1);
    }
}

run();
