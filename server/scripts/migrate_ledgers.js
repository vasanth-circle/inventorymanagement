import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { appConn } from '../config/db.js';
import CustomerLedger from '../models/CustomerLedger.js';
import VendorLedger from '../models/VendorLedger.js';
import Ledger from '../models/Ledger.js';

const migrateLedgers = async () => {
    try {
        console.log('Connecting to databases...');
        // Ensure connection is established
        if (appConn.readyState !== 1) {
            await new Promise((resolve, reject) => {
                appConn.once('open', resolve);
                appConn.once('error', reject);
            });
        }
        
        console.log('Starting ledger migration...');
        
        // 1. Clear existing Ledgers to avoid duplicates if run multiple times
        await Ledger.deleteMany({});
        console.log('Cleared existing unified Ledgers.');

        // 2. Migrate Customer Ledgers
        const customerLedgers = await CustomerLedger.find({});
        console.log(`Found ${customerLedgers.length} CustomerLedger entries. migrating...`);
        
        const newCustomerEntries = customerLedgers.map(cl => ({
            tenantId: cl.tenantId,
            party: cl.customer,
            partyType: 'Customer',
            date: cl.date,
            type: cl.type,
            refType: cl.refType,
            refId: cl.refId,
            refNumber: cl.refNumber,
            description: cl.description,
            debit: cl.debit,
            credit: cl.credit,
            balance: cl.balance,
            paymentMode: cl.paymentMode,
            notes: cl.notes,
            createdBy: cl.createdBy,
            createdAt: cl.createdAt,
            updatedAt: cl.updatedAt
        }));
        
        if (newCustomerEntries.length > 0) {
            await Ledger.insertMany(newCustomerEntries);
        }
        console.log(`Successfully migrated CustomerLedgers.`);

        // 3. Migrate Vendor Ledgers
        const vendorLedgers = await VendorLedger.find({});
        console.log(`Found ${vendorLedgers.length} VendorLedger entries. migrating...`);
        
        const newVendorEntries = vendorLedgers.map(vl => ({
            tenantId: vl.tenantId,
            party: vl.vendor,
            partyType: 'Vendor',
            date: vl.date,
            type: vl.type,
            refType: vl.refType,
            refId: vl.refId,
            refNumber: vl.refNumber,
            description: vl.description,
            debit: vl.debit,
            credit: vl.credit,
            balance: vl.balance,
            paymentMode: vl.paymentMode,
            notes: vl.notes,
            createdBy: vl.createdBy,
            createdAt: vl.createdAt,
            updatedAt: vl.updatedAt
        }));
        
        if (newVendorEntries.length > 0) {
            await Ledger.insertMany(newVendorEntries);
        }
        console.log(`Successfully migrated VendorLedgers.`);
        
        console.log('Migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrateLedgers();
