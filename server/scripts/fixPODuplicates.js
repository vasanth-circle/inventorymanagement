import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;

// Import the real controller to reuse its logic
import { recalculateVendorBalance } from '../controllers/vendorLedgerController.js';
import VendorLedger from '../models/VendorLedger.js';
import Vendor from '../models/Vendor.js';
import { appConn } from '../config/db.js';

async function main() {
    console.log('\n🧹 Fix Duplicate Purchase Order Ledger Entries');
    console.log('=====================================================');

    // Wait for the app connection to be ready if needed
    if (appConn.readyState !== 1) {
        await new Promise(resolve => appConn.once('open', resolve));
    }
    console.log('✅ Connected to MongoDB\n');

    const duplicates = await VendorLedger.aggregate([
        { $match: { refType: 'PurchaseOrder', type: 'bill' } },
        { $group: { _id: "$refId", count: { $sum: 1 }, docs: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } }
    ]);
    
    console.log(`📋 Found ${duplicates.length} POs with duplicate ledger entries\n`);

    if (duplicates.length === 0) {
        console.log('✅ Nothing to fix — no duplicates found.');
        await mongoose.disconnect();
        process.exit(0);
    }

    const affectedVendors = new Set();

    for (const dup of duplicates) {
        // Find all docs for this PO sorted by date/createdAt descending
        const entries = await VendorLedger.find({ _id: { $in: dup.docs } }).sort({ createdAt: -1 });
        
        // Keep the first one (most recent), delete the rest
        const toKeep = entries[0];
        const toDelete = entries.slice(1);
        
        affectedVendors.add(toKeep.vendor.toString());

        console.log(`  🔧 Found ${entries.length} entries for PO ${dup._id} | Keeping ${toKeep._id} | Deleting ${toDelete.length} entries`);

        for (const entry of toDelete) {
            await VendorLedger.deleteOne({ _id: entry._id });
        }
    }

    console.log(`\n──────────────────────────────────────`);
    console.log(`🔁 Recalculating balances for ${affectedVendors.size} vendor(s)...\n`);

    for (const vendorId of affectedVendors) {
        const vendor = await Vendor.findById(vendorId);
        const vendorName = vendor?.name || vendor?.companyName || vendorId;
        
        const finalBalance = await recalculateVendorBalance(vendorId, vendor.tenantId);
        
        console.log(`  ✅ ${vendorName} | Final balance: ₹${finalBalance.toFixed(2)}`);
    }

    console.log(`\n✅ Done! Cleaned up duplicates and recalculated balances.`);
    await mongoose.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Script failed:', err);
    mongoose.disconnect();
    process.exit(1);
});