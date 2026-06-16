import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from '../models/SalesOrder.js';
import Item from '../models/Item.js';
import { appConn } from '../config/db.js';

dotenv.config();

const run = async () => {
    try {
        await appConn.asPromise();
        console.log('Connected to DB');
        
        const orders = await SalesOrder.find({});
        console.log(`Found ${orders.length} orders to check`);
        
        let fixedCount = 0;
        for (const order of orders) {
            let modified = false;
            for (let i = 0; i < order.items.length; i++) {
                const item = order.items[i];
                // If it's billed in sqft and stockQty is missing or 0, or equals quantity but it's clearly a tile with boxes
                if (item.billingUnit === 'sqft') {
                    if (!item.stockQty || item.stockQty === 0 || item.stockQty === item.quantity) {
                        // It should be the box count!
                        if (item.boxCount && item.boxCount > 0 && item.boxCount !== item.stockQty) {
                            item.stockQty = item.boxCount;
                            item.stockUnit = 'boxes';
                            modified = true;
                            console.log(`Order ${order.orderNumber}: Fixed item ${item.name} stockQty to ${item.boxCount} boxes (was ${item.stockQty || '0'})`);
                        }
                    }
                }
            }
            if (modified) {
                await order.save();
                fixedCount++;
            }
        }
        
        console.log(`Finished checking all orders. Fixed ${fixedCount} orders.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
