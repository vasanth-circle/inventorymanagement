/**
 * One-time cleanup script: Delete wrongly created VendorLedger 'Opening Balance'
 * adjustment entries.
 *
 * Problem:
 *   When a vendor was created with an openingBalance, vendorController.js was
 *   incorrectly creating a real VendorLedger record (type='adjustment',
 *   description='Opening Balance'). The opening balance is stored on the Vendor
 *   document itself and displayed as a synthetic row by the frontend — no real
 *   ledger entry is needed. This caused the opening balance to appear twice.
 *
 * What this script does:
 *   1. Finds all VendorLedger entries where type='adjustment' AND
 *      description='Opening Balance' (the wrongly created entries)
 *   2. Deletes them
 *   3. Recalculates running balances for all affected vendors
 *
 * Run from: server/
 *   node scripts/deleteVendorOpeningBalanceEntries.js
 *
 * Add --dry-run to preview without deleting:
 *   node scripts/deleteVendorOpeningBalanceEntries.js --dry-run
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;
if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
}

const genericSchema = new mongoose.Schema({}, { strict: false });
let conn;

async function recalculateVendorBalance(VendorLedger, Vendor, vendorId, tenantId) {
    const vendor = await Vendor.findOne({ _id: vendorId, tenantId });
    if (!vendor) return { finalBalance: 0, changed: 0 };

    const entries = await VendorLedger.find({ vendor: vendorId, tenantId })
        .sort({ date: 1, createdAt: 1 });

    let running = vendor.openingBalance || 0;
    let changed = 0;

    for (const entry of entries) {
        running = running + (entry.credit || 0) - (entry.debit || 0);
        if (entry.balance !== running) {
            if (!DRY_RUN) {
                entry.balance = running;
                await entry.save();
            }
            changed++;
        }
    }

    if (!DRY_RUN) {
        await Vendor.findByIdAndUpdate(vendorId, { currentBalance: running });
    }

    return { finalBalance: running, changed };
}

async function main() {
    console.log('\n🧹 Delete Wrong VendorLedger Opening Balance Entries');
    console.log('=====================================================');
    if (DRY_RUN) console.log('⚠️  DRY RUN — no changes will be saved\n');

    conn = await mongoose.createConnection(MONGO_URI, { family: 4 }).asPromise();
    console.log('✅ Connected to MongoDB\n');

    const VendorLedger = conn.model('VendorLedger', genericSchema);
    const Vendor       = conn.model('Vendor', genericSchema);

    // Find all wrong entries
    const wrongEntries = await VendorLedger.find({
        type: 'adjustment',
        description: 'Opening Balance',
    });

    console.log(`📋 Found ${wrongEntries.length} wrong opening balance entries to delete\n`);

    if (wrongEntries.length === 0) {
        console.log('✅ Nothing to delete — ledger is already clean.');
        await conn.close();
        process.exit(0);
    }

    const affectedVendors = new Set();

    for (const entry of wrongEntries) {
        const vendor = await Vendor.findById(entry.vendor);
        const vendorName = vendor?.name || vendor?.companyName || String(entry.vendor);
        console.log(`  🗑️  ${vendorName} | entry ${entry._id} | ₹${entry.credit || 0} Cr | date: ${new Date(entry.date).toISOString().slice(0, 10)}`);

        if (!DRY_RUN) {
            await VendorLedger.deleteOne({ _id: entry._id });
        }

        affectedVendors.add(`${entry.vendor.toString()}::${entry.tenantId?.toString()}`);
    }

    console.log(`\n──────────────────────────────────────`);
    console.log(`🔁 Recalculating balances for ${affectedVendors.size} vendor(s)...\n`);

    for (const key of affectedVendors) {
        const [vendorId, tenantId] = key.split('::');
        const vendor = await Vendor.findById(vendorId);
        const vendorName = vendor?.name || vendor?.companyName || vendorId;

        const result = await recalculateVendorBalance(
            VendorLedger, Vendor,
            new mongoose.Types.ObjectId(vendorId),
            tenantId ? new mongoose.Types.ObjectId(tenantId) : undefined,
        );

        console.log(`  ✅ ${vendorName} | Final balance: ₹${result.finalBalance.toFixed(2)} | Re-balanced entries: ${result.changed}`);
    }

    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN complete — no data changed. Remove --dry-run to apply.');
    } else {
        console.log(`\n✅ Done! Deleted ${wrongEntries.length} wrong entries and recalculated ${affectedVendors.size} vendor balance(s).`);
    }

    await conn.close();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Script failed:', err);
    if (conn) conn.close().catch(() => {});
    process.exit(1);
});
