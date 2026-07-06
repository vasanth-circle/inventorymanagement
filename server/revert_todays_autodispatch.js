import dotenv from 'dotenv';
dotenv.config();

import { appConn } from './config/db.js';
import SalesOrder from './models/SalesOrder.js';
import Dispatch from './models/Dispatch.js';
import Item from './models/Item.js';
import Transaction from './models/Transaction.js';

const revertTodaysDispatches = async () => {
    try {
        console.log('Waiting for database connection...');
        
        // Wait a second for appConn to establish
        await new Promise(res => setTimeout(res, 2000));

        // Find today's date
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        // Find all auto-dispatches from today
        const dispatches = await Dispatch.find({
            notes: 'Auto-dispatched upon invoice confirmation',
            createdAt: { $gte: startOfDay }
        });

        console.log(`Found ${dispatches.length} auto-dispatches from today.`);

        for (const dispatch of dispatches) {
            const order = await SalesOrder.findById(dispatch.order);
            if (!order) {
                console.log(`Order not found for dispatch ${dispatch.dispatchNumber}`);
                continue;
            }
            
            console.log(`\nReverting dispatch ${dispatch.dispatchNumber} for order ${order.orderNumber}...`);

            // 1. Revert stock in Items
            for (const dispatchItem of dispatch.items) {
                const itemDoc = await Item.findById(dispatchItem.item);
                if (itemDoc) {
                    itemDoc.quantity += dispatchItem.quantity;
                    await itemDoc.save();
                    console.log(`Restored ${dispatchItem.quantity} to item ${itemDoc.name} (New Qty: ${itemDoc.quantity})`);
                }
            }

            // 2. Delete the associated outward transactions
            const deleteResult = await Transaction.deleteMany({
                type: 'outward',
                reason: `Auto-Dispatch for Order ${order.orderNumber}`,
                createdAt: { $gte: startOfDay },
            });
            console.log(`Deleted ${deleteResult.deletedCount} transaction logs for this auto-dispatch.`);

            // 3. Update Sales Order
            order.status = 'confirmed';
            // Remove batchAllocations
            for (let orderItem of order.items) {
                if (orderItem.batchAllocations) {
                    orderItem.batchAllocations = [];
                }
            }
            await order.save();
            console.log(`Reset order ${order.orderNumber} back to 'confirmed'.`);

            // 4. Delete the dispatch record
            await Dispatch.findByIdAndDelete(dispatch._id);
            console.log(`Deleted dispatch document ${dispatch.dispatchNumber}.`);
        }

        console.log('\nAll done!');
        process.exit(0);

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

revertTodaysDispatches();
