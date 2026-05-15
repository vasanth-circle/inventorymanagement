import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { appConn, coreConn } from './config/db.js';
import User from './models/User.js';
import SalesOrder from './models/SalesOrder.js';
import Customer from './models/Customer.js';
import CustomerLedger from './models/CustomerLedger.js';
import Setting from './models/Setting.js';

async function fixData() {
    try {
        console.log(`Fixing ledger and logo...`);

        await Promise.all([
            new Promise(resolve => appConn.readyState === 1 ? resolve() : appConn.once('open', resolve)),
            new Promise(resolve => coreConn.readyState === 1 ? resolve() : coreConn.once('open', resolve))
        ]);

        const user = await User.findOne({ email: 'srinath@techath.com' });
        if (!user || !user.tenantId) {
            console.error('Tenant not found');
            process.exit(1);
        }
        
        const tenantId = user.tenantId;

        // 1. Update logo in Settings
        await Setting.findOneAndUpdate(
            { tenantId },
            { $set: { 'branding.logoUrl': '/uploads/techath_logo.png' } },
            { new: true }
        );
        console.log('✅ Updated Settings with new sample logo.');

        // 2. Fix ledgers for all Sales Orders for this tenant
        const orders = await SalesOrder.find({ tenantId, isEstimation: false, status: { $in: ['confirmed', 'delivered'] } });
        
        for (const order of orders) {
            // Check if ledger entry already exists
            const existingLedger = await CustomerLedger.findOne({ refId: order._id });
            
            if (!existingLedger) {
                // Create ledger entry (Debit - customer owes money)
                await CustomerLedger.create({
                    tenantId,
                    customer: order.customer,
                    date: order.orderDate,
                    type: 'bill',
                    refType: 'SalesOrder',
                    refId: order._id,
                    refNumber: order.orderNumber,
                    description: `Invoice ${order.orderNumber}`,
                    debit: order.totalAmount,
                    credit: 0,
                    balance: order.totalAmount,
                    createdBy: user._id
                });
                
                // Update customer balance
                await Customer.findByIdAndUpdate(order.customer, {
                    $inc: { currentBalance: order.totalAmount }
                });
                
                console.log(`✅ Created ledger entry for Invoice ${order.orderNumber} (₹${order.totalAmount})`);
            }
        }

        console.log('🎉 Fix completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during fix:', error);
        process.exit(1);
    }
}

fixData();
