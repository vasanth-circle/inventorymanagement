import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;

async function main() {
    const conn = await mongoose.createConnection(MONGO_URI, { family: 4 }).asPromise();
    const VendorLedger = conn.model('VendorLedger', new mongoose.Schema({}, { strict: false }));
    const Vendor = conn.model('Vendor', new mongoose.Schema({}, { strict: false }));

    const vendor = await Vendor.findOne({ $or: [{ name: /ALAGHU/i }, { companyName: /ALAGHU/i }] });
    if(vendor) {
        console.log(`Found Vendor: ${vendor.name || vendor.companyName}`);
        const entries = await VendorLedger.find({ vendor: vendor._id, description: /PO-00117/i });
        console.log(`Found ${entries.length} entries for PO-00117`);
        for(const e of entries) {
            console.log(e._id, e.type, e.description, e.refNumber, 'credit:', e.credit, 'date:', e.createdAt);
        }
    } else {
        console.log('Vendor ALAGHU not found');
    }

    // Now let's group by refId and refType = 'PurchaseOrder' to see all duplicates
    const duplicates = await VendorLedger.aggregate([
        { $match: { refType: 'PurchaseOrder', type: 'bill' } },
        { $group: { _id: "$refId", count: { $sum: 1 }, docs: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } }
    ]);
    
    console.log(`\nFound ${duplicates.length} POs with duplicate ledger entries`);

    await conn.close();
    process.exit(0);
}
main();