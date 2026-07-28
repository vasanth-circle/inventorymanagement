/**
 * Migration Script: Update VendorLedger refNumber to use Vendor Bill Number
 *
 * Run: node scripts/updateVendorLedgerRefNumbers.js
 *
 * This updates existing ledger bill entries that currently store the PO order number
 * (e.g. PO-00051) to instead store the vendor's bill number (e.g. INV-123).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { appConn } from '../config/db.js';
import VendorLedger from '../models/VendorLedger.js';
import PurchaseOrder from '../models/PurchaseOrder.js';

async function migrate() {
    console.log('Waiting for DB connection...');
    await new Promise((resolve) => {
        if (appConn.readyState === 1) return resolve();
        appConn.once('connected', resolve);
        setTimeout(resolve, 5000);
    });

    const entries = await VendorLedger.find({
        type: 'bill',
        refType: 'PurchaseOrder',
    });

    console.log('Found bill entries:', entries.length);
    let updated = 0;
    let skipped = 0;

    for (const entry of entries) {
        if (!entry.refId) { skipped++; continue; }

        const po = await PurchaseOrder.findById(entry.refId).select('orderNumber vendorBillNumber').lean();
        if (!po || !po.vendorBillNumber) {
            console.log('  [SKIP] No vendorBillNumber for refId:', entry.refId);
            skipped++;
            continue;
        }

        if (entry.refNumber === po.orderNumber || !entry.refNumber) {
            await VendorLedger.findByIdAndUpdate(entry._id, { refNumber: po.vendorBillNumber });
            console.log('  [OK]', po.orderNumber, '->', po.vendorBillNumber);
            updated++;
        } else {
            console.log('  [SKIP] Already updated:', entry.refNumber);
            skipped++;
        }
    }

    console.log('\nDone. Updated:', updated, '| Skipped:', skipped);
    process.exit(0);
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
