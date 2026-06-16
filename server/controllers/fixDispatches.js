import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Dispatch from '../models/Dispatch.js';
import SalesOrder from '../models/SalesOrder.js';
import { appConn } from '../config/db.js';

dotenv.config();

const run = async () => {
    try {
        await appConn.asPromise();
        console.log('Connected to DB');
        
        const dispatches = await Dispatch.find({});
        console.log(`Found ${dispatches.length} dispatches to check`);
        
        let fixedCount = 0;
        for (const dispatch of dispatches) {
            let modified = false;
            const order = await SalesOrder.findById(dispatch.order);
            if (!order) continue;

            for (let i = 0; i < dispatch.items.length; i++) {
                const dispatchItem = dispatch.items[i];
                const orderItem = order.items.find(oi => oi.item.toString() === dispatchItem.item.toString());
                
                if (orderItem && orderItem.billingUnit === 'sqft') {
                    // if dispatch quantity is >= sqft quantity, it means it dispatched sqft
                    // and needs to be converted to boxes
                    if (dispatchItem.quantity === orderItem.quantity && orderItem.quantity > orderItem.boxCount) {
                        console.log(`Dispatch ${dispatch.dispatchNumber}: Fixing ${dispatchItem.quantity} to ${orderItem.boxCount} boxes`);
                        dispatchItem.quantity = orderItem.boxCount;
                        dispatchItem.unit = 'boxes';
                        modified = true;
                    } else if (dispatchItem.quantity > orderItem.boxCount) {
                         // Some arbitrary high number that was probably sqft
                         // We can guess the boxes by dividing by sqFtPerPc, but we don't have item doc here easily.
                         // But if dispatch item qty > order box count, it's definitely wrong if stockQty is box count.
                         console.log(`Dispatch ${dispatch.dispatchNumber} has suspiciously high qty: ${dispatchItem.quantity} (Order box count is ${orderItem.boxCount})`);
                    }
                }
            }
            if (modified) {
                await dispatch.save();
                fixedCount++;
            }
        }
        
        console.log(`Finished checking all dispatches. Fixed ${fixedCount} dispatches.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
