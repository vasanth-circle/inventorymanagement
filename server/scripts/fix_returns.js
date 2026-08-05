import mongoose from 'mongoose';
import db from '../config/db.js';
import CustomerLedger from '../models/CustomerLedger.js';
import VendorLedger from '../models/VendorLedger.js';
import Customer from '../models/Customer.js';
import Vendor from '../models/Vendor.js';

const run = async () => {
    try {
        console.log('Connected to DB via pool');
        console.log('Recalculating all ledger balances...');
        
        const customers = await CustomerLedger.distinct('customer');
        for (const c of customers) {
            const entries = await CustomerLedger.find({ customer: c }).sort({ date: 1, createdAt: 1 });
            let balance = 0;
            const cust = await Customer.findById(c);
            balance = cust?.openingBalance || 0;
            for (const e of entries) {
                balance = balance + (e.debit || 0) - (e.credit || 0);
                e.balance = balance;
                await e.save();
            }
            if (cust) {
                cust.currentBalance = balance;
                await cust.save();
            }
        }

        const vendors = await VendorLedger.distinct('vendor');
        for (const v of vendors) {
            const entries = await VendorLedger.find({ vendor: v }).sort({ date: 1, createdAt: 1 });
            let balance = 0;
            const vend = await Vendor.findById(v);
            balance = vend?.openingBalance || 0;
            for (const e of entries) {
                balance = balance + (e.credit || 0) - (e.debit || 0);
                e.balance = balance;
                await e.save();
            }
            if (vend) {
                vend.currentBalance = balance;
                await vend.save();
            }
        }
        
        console.log('Ledger recalculation complete.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
