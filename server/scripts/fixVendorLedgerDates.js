/**
 * One-time fix script: Fix VendorLedger bill entry dates to use billDate
 * instead of orderDate (PO entry date).
 *
 * Problem:
 *   When a purchase order was received/billed, the VendorLedger 'bill' entry
 *   was created using `orderDate` (the PO creation/entry date) instead of
 *   `billDate` (the actual vendor bill date). This caused ledger entries and
 *   outstanding balance checks to show the wrong dates.
 *
 * What this script does:
 *   1. Finds all VendorLedger entries of type 'bill' with refType 'PurchaseOrder'
 *   2. For each entry, looks up the linked PurchaseOrder via refId
 *   3. If the PurchaseOrder has a billDate AND it differs from the ledger date,
 *      updates the ledger entry date to use billDate
 *   4. After patching all dates, recalculates the running balance for every
 *      affected vendor (sorted chronologically by the corrected dates)
 *
 * Run from: server/
 *   node scripts/fixVendorLedgerDates.js
 *
 * Add --dry-run to preview changes without saving:
 *   node scripts/fixVendorLedgerDates.js --dry-run
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

// ─── MongoDB URI ──────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;
if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
}

// ─── Inline schemas (strict:false to avoid mismatch) ─────────────────────────
const genericSchema = new mongoose.Schema({}, { strict: false });

let conn;

// ─── Helper: Recalculate running balance for a vendor ────────────────────────
async function recalculateVendorBalance(VendorLedger, Vendor, vendorId, tenantId) {
    const vendor = await Vendor.findOne({ _id: vendorId, tenantId });
    if (!vendor) return { finalBalance: 0, rebalancedEntries: 0 };

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

    return { finalBalance: running, rebalancedEntries: changed };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n🔧 Fix VendorLedger Bill Dates Script');
    console.log('======================================');
    if (DRY_RUN) {
        console.log('⚠️  DRY RUN MODE — no changes will be saved\n');
    }

    conn = await mongoose.createConnection(MONGO_URI, { family: 4 }).asPromise();
    console.log('✅ Connected to MongoDB\n');

    const VendorLedger  = conn.model('VendorLedger', genericSchema);
    const PurchaseOrder = conn.model('PurchaseOrder', genericSchema);
    const Vendor        = conn.model('Vendor', genericSchema);

    // 1. Find all 'bill' ledger entries linked to PurchaseOrders
    const billEntries = await VendorLedger.find({
        type: 'bill',
        refType: 'PurchaseOrder',
        refId: { $ne: null },
    });

    console.log(`📋 Found ${billEntries.length} VendorLedger bill entries to check\n`);

    let patchedCount  = 0;
    let skippedNoBill = 0;
    let skippedSame   = 0;
    let notFound      = 0;
    const affectedVendors = new Set();

    for (const entry of billEntries) {
        const po = await PurchaseOrder.findById(entry.refId);

        if (!po) {
            console.log(`  ⚠️  PO not found for ledger entry ${entry._id} (refId: ${entry.refId}) — skipping`);
            notFound++;
            continue;
        }

        if (!po.billDate) {
            // PO has no bill date set — nothing to fix
            skippedNoBill++;
            continue;
        }

        const currentDate = new Date(entry.date);
        const correctDate = new Date(po.billDate);

        // Compare by date only (ignore time component)
        const currentDateStr = currentDate.toISOString().slice(0, 10);
        const correctDateStr = correctDate.toISOString().slice(0, 10);

        if (currentDateStr === correctDateStr) {
            // Already correct — nothing to do
            skippedSame++;
            continue;
        }

        // ── Date mismatch — needs fix ─────────────────────────────────────────
        console.log(
            `  🔄 PO ${po.orderNumber} | Ledger entry ${entry._id}` +
            `\n     Current date : ${currentDateStr}` +
            `\n     Correct date : ${correctDateStr} (billDate)` +
            `\n     Amount       : ₹${entry.credit || 0}`
        );

        if (!DRY_RUN) {
            entry.date = correctDate;
            await entry.save();
        }

        patchedCount++;
        affectedVendors.add(`${entry.vendor.toString()}::${entry.tenantId?.toString()}`);
    }

    console.log('\n──────────────────────────────────────');
    console.log('📊 Summary:');
    console.log(`   Total checked   : ${billEntries.length}`);
    console.log(`   Patched         : ${patchedCount}`);
    console.log(`   Already correct : ${skippedSame}`);
    console.log(`   No bill date    : ${skippedNoBill}  (PO had no billDate — skipped)`);
    console.log(`   PO not found    : ${notFound}`);
    console.log(`   Vendors affected: ${affectedVendors.size}`);

    // 2. Recalculate running balances for all affected vendors
    if (affectedVendors.size > 0) {
        console.log('\n🔁 Recalculating vendor balances...\n');

        for (const key of affectedVendors) {
            const [vendorId, tenantId] = key.split('::');
            const vendor = await Vendor.findById(vendorId);
            const vendorName = vendor?.name || vendor?.companyName || vendorId;

            const result = await recalculateVendorBalance(
                VendorLedger,
                Vendor,
                new mongoose.Types.ObjectId(vendorId),
                tenantId ? new mongoose.Types.ObjectId(tenantId) : undefined,
            );

            console.log(
                `  ✅ ${vendorName}` +
                ` | Final balance : ₹${result.finalBalance.toFixed(2)}` +
                ` | Re-balanced entries : ${result.rebalancedEntries}`
            );
        }
    } else {
        console.log('\n✅ No vendor balances need recalculation.');
    }

    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN complete — no data was changed.');
        console.log('   Remove --dry-run flag to apply fixes.');
    } else {
        console.log('\n✅ All done! Dates corrected and balances recalculated.');
    }

    await conn.close();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Script failed:', err);
    if (conn) conn.close().catch(() => {});
    process.exit(1);
});
