import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

import { appConn } from '../config/db.js';
import SalesOrder from '../models/SalesOrder.js';
import CustomerLedger from '../models/CustomerLedger.js';
import { getNextSequenceValue } from '../utils/sequence.js';

const fixEstimationNumbers = async () => {
    try {
        console.log('Connecting to database...');
        // Let db.js handle connection, wait a moment for it to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Finding converted estimations (isEstimation: false but orderNumber starts with E-)...');
        const wrongOrders = await SalesOrder.find({
            isEstimation: false,
            orderNumber: /^E-/
        });

        console.log(`Found ${wrongOrders.length} orders to fix.`);

        for (const order of wrongOrders) {
            const oldOrderNumber = order.orderNumber;
            let retries = 0;
            let assigned = false;
            let newOrderNumber = '';
            
            while (!assigned && retries < 10) {
                try {
                    const seq = await getNextSequenceValue('INV', order.tenantId);
                    newOrderNumber = `${seq}`;
                    order.orderNumber = newOrderNumber;
                    await order.save();
                    assigned = true;
                } catch (err) {
                    if (err.code === 11000) {
                        retries++;
                    } else {
                        throw err;
                    }
                }
            }

            if (!assigned) {
                console.error(`Failed to assign new number for order ID ${order._id}`);
                continue;
            }

            console.log(`Updated Order ID ${order._id}: ${oldOrderNumber} -> ${newOrderNumber}`);

            // Update Customer Ledger entries
            const ledgerEntries = await CustomerLedger.find({
                refId: order._id,
                refType: 'SalesOrder'
            });

            for (const entry of ledgerEntries) {
                let updated = false;
                if (entry.refNumber === oldOrderNumber) {
                    entry.refNumber = newOrderNumber;
                    updated = true;
                }
                if (entry.description && entry.description.includes(oldOrderNumber)) {
                    entry.description = entry.description.replace(oldOrderNumber, newOrderNumber);
                    updated = true;
                }
                
                if (updated) {
                    await entry.save();
                    console.log(`  Updated Ledger Entry ${entry._id}`);
                }
            }
        }

        console.log('Finished fixing estimation numbers.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixEstimationNumbers();
