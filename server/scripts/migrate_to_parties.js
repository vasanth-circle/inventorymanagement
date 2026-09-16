import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.APP_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/inventorymanagement';

// Since this is a migration script, we can interact directly with the DB collections
const migrate = async () => {
    try {
        console.log(`Connecting to ${MONGODB_URI}...`);
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;

        console.log('Fetching customers...');
        const customers = await db.collection('customers').find({}).toArray();
        console.log(`Found ${customers.length} customers.`);

        console.log('Fetching vendors...');
        const vendors = await db.collection('vendors').find({}).toArray();
        console.log(`Found ${vendors.length} vendors.`);

        const partiesCollection = db.collection('parties');
        let partiesInserted = 0;
        let partiesMerged = 0;

        // Create a map to merge entities by name and tenantId
        const partyMap = new Map();

        // 1. Process Customers
        for (const customer of customers) {
            const key = `${customer.name.trim().toLowerCase()}-${customer.tenantId}`;
            partyMap.set(key, {
                ...customer,
                isCustomer: true,
                isVendor: false,
                legacyCustomerId: customer._id,
                legacyVendorId: null,
            });
        }

        // 2. Process Vendors and merge if they exist as customers
        for (const vendor of vendors) {
            const key = `${vendor.name.trim().toLowerCase()}-${vendor.tenantId}`;
            if (partyMap.has(key)) {
                // Merge logic
                const existing = partyMap.get(key);
                existing.isVendor = true;
                existing.legacyVendorId = vendor._id;
                // Add vendor balance to customer balance
                existing.openingBalance = (existing.openingBalance || 0) - (vendor.openingBalance || 0); // Customer balance is Dr (+), Vendor is Cr (-)
                existing.currentBalance = (existing.currentBalance || 0) - (vendor.currentBalance || 0);
                partiesMerged++;
            } else {
                partyMap.set(key, {
                    ...vendor,
                    isCustomer: false,
                    isVendor: true,
                    legacyCustomerId: null,
                    legacyVendorId: vendor._id,
                    // Negate vendor balances to match unified ledger where Dr is +, Cr is -
                    openingBalance: -(vendor.openingBalance || 0),
                    currentBalance: -(vendor.currentBalance || 0),
                });
            }
        }

        // 3. Insert into Parties collection
        console.log('Inserting into Parties collection...');
        const newParties = Array.from(partyMap.values());
        
        // Clear existing parties if any
        await partiesCollection.deleteMany({});

        for (const p of newParties) {
            // Keep the customer ID as the primary ID if it exists, otherwise use vendor ID
            p._id = p.legacyCustomerId || p.legacyVendorId;
            await partiesCollection.insertOne(p);
            partiesInserted++;
        }
        console.log(`Inserted ${partiesInserted} parties (${partiesMerged} were merged from Customer+Vendor).`);

        // 4. Update Ledgers, SalesOrders, PurchaseOrders to use the unified Party IDs
        console.log('Updating Ledgers...');
        const ledgers = await db.collection('ledgers').find({}).toArray();
        for (const l of ledgers) {
            let unifiedPartyId = l.party;
            if (l.partyType === 'Vendor') {
                // Find the vendor in newParties
                const matchedParty = newParties.find(p => p.legacyVendorId && p.legacyVendorId.toString() === l.party.toString());
                if (matchedParty) {
                    unifiedPartyId = matchedParty._id;
                }
            }
            await db.collection('ledgers').updateOne(
                { _id: l._id },
                { 
                    $set: { party: unifiedPartyId },
                    $unset: { partyType: "" }
                }
            );
        }

        console.log('Updating Sales Orders...');
        const salesOrders = await db.collection('salesorders').find({}).toArray();
        for (const so of salesOrders) {
            await db.collection('salesorders').updateOne(
                { _id: so._id },
                { $set: { party: so.customer }, $unset: { customer: "" } }
            );
        }

        console.log('Updating Purchase Orders...');
        const purchaseOrders = await db.collection('purchaseorders').find({}).toArray();
        for (const po of purchaseOrders) {
            let unifiedPartyId = po.vendor;
            const matchedParty = newParties.find(p => p.legacyVendorId && p.legacyVendorId.toString() === po.vendor.toString());
            if (matchedParty) {
                unifiedPartyId = matchedParty._id;
            }
            await db.collection('purchaseorders').updateOne(
                { _id: po._id },
                { $set: { party: unifiedPartyId }, $unset: { vendor: "" } }
            );
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
};

migrate();
