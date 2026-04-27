/**
 * seedDemo.js
 * ============================================================
 * Comprehensive demo seed for the tenant of srinath@techath.com
 *
 * Usage:
 *   cd server
 *   node seedDemo.js
 *
 * Requirements:
 *   - APP_MONGODB_URI (or MONGODB_URI) and CORE_MONGODB_URI set in .env
 *   - The user srinath@techath.com must already exist in coreConn
 *
 * Behaviour:
 *   - Idempotent: skips records that already exist (upsert / findOne guard)
 *   - Does NOT reset the user password or recreate the tenant
 * ============================================================
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { appConn, coreConn } from './config/db.js';

// ── Models ────────────────────────────────────────────────────
import User from './models/User.js';
import Tenant from './models/Tenant.js';
import Category from './models/Category.js';
import Location from './models/Location.js';
import Setting from './models/Setting.js';
import Vendor from './models/Vendor.js';
import Customer from './models/Customer.js';
import CustomerLedger from './models/CustomerLedger.js';
import Item from './models/Item.js';
import PurchaseOrder from './models/PurchaseOrder.js';
import Quotation from './models/Quotation.js';
import SalesOrder from './models/SalesOrder.js';
import Dispatch from './models/Dispatch.js';
import Transaction from './models/Transaction.js';
import Counter from './models/Counter.js';

// ── Helpers ───────────────────────────────────────────────────
const log = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.warn(`  ⚠️  ${msg}`);
const section = (msg) => console.log(`\n🔷 ${msg}`);

const waitForConn = (conn, name) =>
    new Promise((resolve, reject) => {
        if (conn.readyState === 1) return resolve();
        conn.once('open', resolve);
        conn.once('error', reject);
    });

// ── Main Seed Function ────────────────────────────────────────
const seedDemo = async () => {
    try {
        console.log('\n🚀 Starting Demo Seed for srinath@techath.com...');
        await Promise.all([
            waitForConn(appConn, 'App'),
            waitForConn(coreConn, 'Core'),
        ]);
        console.log('   DB connections ready.\n');

        // ══════════════════════════════════════════════════════
        // STEP 1: Resolve Tenant & User from existing records
        // ══════════════════════════════════════════════════════
        section('Step 1 — Resolving existing Tenant & User');

        const user = await User.findOne({ email: 'srinath@techath.com' }).select('+tenantId');
        if (!user) {
            console.error('  ❌ User srinath@techath.com not found in coreConn. Aborting.');
            process.exit(1);
        }

        const tenantId = user.tenantId;
        const userId = user._id;

        if (!tenantId) {
            console.error('  ❌ User found but has no tenantId linked. Please link the tenant first. Aborting.');
            process.exit(1);
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            console.error(`  ❌ Tenant with id=${tenantId} not found in coreConn. Aborting.`);
            process.exit(1);
        }

        log(`User   : ${user.name} (${user.email}) — _id: ${userId}`);
        log(`Tenant : ${tenant.businessName} — _id: ${tenantId}`);

        // ══════════════════════════════════════════════════════
        // STEP 2: Settings
        // ══════════════════════════════════════════════════════
        section('Step 2 — Settings');

        await Setting.findOneAndUpdate(
            { tenantId },
            {
                $set: {
                    tenantId,
                    companyName: tenant.businessName || 'Techath Solutions',
                    address: '12, Tech Park, Bangalore - 560001',
                    phone1: '9876543200',
                    phone2: '9876543201',
                    gstNumber: '29AABCT1332L1ZP',
                    invoicePrefix: 'INV',
                    estimatePrefix: 'EST',
                    unitConfig: {
                        quantityBasis: 'pieces',
                        secondaryUnit: 'none',
                        rateBasis: 'per_piece',
                        quantityLabel: 'Qty',
                        secondaryLabel: '',
                        rateLabel: 'Rate',
                    },
                    documentConfig: {
                        quotationPrefix: 'QUO',
                        quotationCounter: 0,
                        quotationTitle: 'Quotation',
                        invoiceTitle: 'Tax Invoice',
                        quotationTemplate: 1,
                        invoiceTemplate: 1,
                        currency: 'INR',
                        currencySymbol: '₹',
                        taxLabel: 'GST',
                        defaultTaxRate: 18,
                        showSecondaryQty: false,
                    },
                    pricingConfig: {
                        preventSellingBelowPurchase: false,
                        validatePurchasePrice: false,
                    },
                    branding: {
                        tagline: 'Quality | Trust | Delivery',
                        website: 'www.techath.com',
                        email: 'info@techath.com',
                        bankName: 'HDFC Bank',
                        accountNumber: '50200012345678',
                        ifscCode: 'HDFC0001234',
                        termsAndConditions:
                            '1. Goods once sold will not be taken back.\n2. Payment due within 30 days.\n3. E. & O.E.',
                    },
                },
            },
            { upsert: true, new: true }
        );
        log('Settings upserted (created or updated with demo values)');

        // ══════════════════════════════════════════════════════
        // STEP 3: Locations
        // ══════════════════════════════════════════════════════
        section('Step 3 — Locations');

        const locationData = [
            { name: 'Main Warehouse', description: 'Primary storage and dispatch location' },
            { name: 'Showroom', description: 'Retail display floor' },
        ];
        const locationMap = {};
        for (const loc of locationData) {
            const existing = await Location.findOne({ name: loc.name, tenantId });
            if (!existing) {
                const created = await Location.create({ ...loc, tenantId });
                locationMap[loc.name] = created._id;
                log(`Location created: ${loc.name}`);
            } else {
                locationMap[loc.name] = existing._id;
                warn(`Location already exists: ${loc.name}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 4: Categories
        // ══════════════════════════════════════════════════════
        section('Step 4 — Categories');

        const categoryData = [
            { name: 'Electronics', description: 'Electronic devices and accessories' },
            { name: 'Furniture', description: 'Office and home furniture' },
            { name: 'Stationery', description: 'Office supplies and stationery items' },
            { name: 'Hardware', description: 'Tools and hardware equipment' },
            { name: 'Consumables', description: 'Consumable items and office supplies' },
        ];
        const categoryMap = {};
        for (const cat of categoryData) {
            const existing = await Category.findOne({ name: cat.name, tenantId });
            if (!existing) {
                const created = await Category.create({ ...cat, tenantId });
                categoryMap[cat.name] = created._id;
                log(`Category created: ${cat.name}`);
            } else {
                categoryMap[cat.name] = existing._id;
                warn(`Category already exists: ${cat.name}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 5: Vendors
        // ══════════════════════════════════════════════════════
        section('Step 5 — Vendors');

        const vendorData = [
            {
                name: 'Ravi Supplies',
                companyName: 'Ravi & Co',
                email: 'ravi@ravisupplies.com',
                phone: '9876543210',
                gstin: '29AABCR1234L1ZX',
                address: { street: '45 Market St', city: 'Bangalore', state: 'Karnataka', zipCode: '560002', country: 'India' },
                openingBalance: 0,
            },
            {
                name: 'Global Tech',
                companyName: 'Global Tech Pvt Ltd',
                email: 'sales@globaltech.com',
                phone: '9876543211',
                gstin: '29AABCG5678L1ZY',
                address: { street: '78 Tech Road', city: 'Bangalore', state: 'Karnataka', zipCode: '560003', country: 'India' },
                openingBalance: 0,
            },
            {
                name: 'Office Essentials',
                companyName: 'OE Trading',
                email: 'orders@oetrading.com',
                phone: '9876543212',
                gstin: '29AABCO9012L1ZZ',
                address: { street: '22 Commerce Ave', city: 'Bangalore', state: 'Karnataka', zipCode: '560004', country: 'India' },
                openingBalance: 0,
            },
        ];
        const vendorMap = {};
        for (const v of vendorData) {
            const existing = await Vendor.findOne({ name: v.name, tenantId });
            if (!existing) {
                const created = await Vendor.create({ ...v, tenantId });
                vendorMap[v.name] = created._id;
                log(`Vendor created: ${v.name}`);
            } else {
                vendorMap[v.name] = existing._id;
                warn(`Vendor already exists: ${v.name}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 6: Items
        // ══════════════════════════════════════════════════════
        section('Step 6 — Items (Inventory)');

        const itemData = [
            { name: 'Dell Laptop 15"',     sku: 'DELL-LAP-001', category: 'Electronics',  quantity: 25, purchasePrice: 45000, price: 55000, minStockThreshold: 5,  brand: 'Dell',    description: '15-inch Dell Laptop Core i5 16GB RAM' },
            { name: 'HP Printer LaserJet', sku: 'HP-PRN-001',   category: 'Electronics',  quantity: 10, purchasePrice: 12000, price: 15000, minStockThreshold: 3,  brand: 'HP',      description: 'HP LaserJet mono laser printer' },
            { name: 'Samsung Monitor 24"', sku: 'SAM-MON-001',  category: 'Electronics',  quantity: 15, purchasePrice: 8500,  price: 11000, minStockThreshold: 3,  brand: 'Samsung', description: '24-inch Full HD IPS monitor' },
            { name: 'Executive Chair',     sku: 'EXE-CHR-001',  category: 'Furniture',    quantity: 20, purchasePrice: 3500,  price: 5000,  minStockThreshold: 5,  brand: 'ErgoMax', description: 'High-back ergonomic office chair' },
            { name: 'Office Desk 4ft',     sku: 'OFF-DSK-001',  category: 'Furniture',    quantity: 8,  purchasePrice: 4500,  price: 6500,  minStockThreshold: 2,  brand: 'WoodCraft',description: '4-feet wooden office desk' },
            { name: 'A4 Paper Ream',       sku: 'A4-PAP-001',   category: 'Stationery',   quantity: 200, purchasePrice: 200, price: 350,   minStockThreshold: 20, brand: 'Bilt',    description: '500-sheet A4 paper ream 75 GSM' },
            { name: 'Ball Pen Box',        sku: 'BLP-BOX-001',  category: 'Stationery',   quantity: 100, purchasePrice: 60,  price: 120,   minStockThreshold: 10, brand: 'Reynolds',description: 'Box of 10 ball pens' },
            { name: 'Hammer',              sku: 'HAM-001',       category: 'Hardware',     quantity: 30, purchasePrice: 250,  price: 450,   minStockThreshold: 5,  brand: 'Stanley', description: 'Steel claw hammer 500g' },
            { name: 'Drill Machine',       sku: 'DRL-001',       category: 'Hardware',     quantity: 12, purchasePrice: 1800, price: 2800,  minStockThreshold: 3,  brand: 'Bosch',   description: '500W corded drill machine' },
            { name: 'Toner Cartridge',     sku: 'TON-001',       category: 'Consumables',  quantity: 18, purchasePrice: 900,  price: 1400,  minStockThreshold: 5,  brand: 'HP',      description: 'HP LaserJet compatible toner  cartridge' },
        ];

        const itemMap = {};
        for (const it of itemData) {
            const existing = await Item.findOne({ sku: it.sku, tenantId });
            if (!existing) {
                const created = await Item.create({
                    name: it.name,
                    sku: it.sku,
                    category: categoryMap[it.category],
                    quantity: it.quantity,
                    purchasePrice: it.purchasePrice,
                    price: it.price,
                    minStockThreshold: it.minStockThreshold,
                    brand: it.brand,
                    description: it.description,
                    location: 'Main Warehouse',
                    pcsPerBox: 1,
                    sqFtPerPc: 0,
                    tenantId,
                });
                itemMap[it.name] = created._id;
                log(`Item created: ${it.name} (qty: ${it.quantity})`);
            } else {
                itemMap[it.name] = existing._id;
                warn(`Item already exists: ${it.name}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 7: Customers
        // ══════════════════════════════════════════════════════
        section('Step 7 — Customers');

        const customerData = [
            {
                name: 'Arjun Traders',
                companyName: 'Arjun Traders Pvt Ltd',
                email: 'arjun@arjuntraders.com',
                phone: '9812345678',
                gstin: '29AABCA1111L1ZA',
                address: {
                    billing: { street: '10 Ring Road', city: 'Bangalore', state: 'Karnataka', zipCode: '560010', country: 'India' },
                    shipping: { street: '10 Ring Road', city: 'Bangalore', state: 'Karnataka', zipCode: '560010', country: 'India' },
                },
                openingBalance: 15000,
                currentBalance: 15000,
            },
            {
                name: 'Priya Retail',
                companyName: 'Priya Retail Store',
                email: 'priya@priyaretail.com',
                phone: '9823456789',
                gstin: '29AABCP2222L1ZB',
                address: {
                    billing: { street: '22 MG Road', city: 'Mysore', state: 'Karnataka', zipCode: '570001', country: 'India' },
                    shipping: { street: '22 MG Road', city: 'Mysore', state: 'Karnataka', zipCode: '570001', country: 'India' },
                },
                openingBalance: 0,
                currentBalance: 0,
            },
            {
                name: 'Suresh Enterprises',
                companyName: 'Suresh Enterprises',
                email: 'suresh@sureshent.com',
                phone: '9834567890',
                gstin: '29AABCS3333L1ZC',
                address: {
                    billing: { street: '5 Industrial Area', city: 'Hubli', state: 'Karnataka', zipCode: '580001', country: 'India' },
                    shipping: { street: '5 Industrial Area', city: 'Hubli', state: 'Karnataka', zipCode: '580001', country: 'India' },
                },
                openingBalance: 8500,
                currentBalance: 8500,
            },
            {
                name: 'MK Constructions',
                companyName: 'MK Constructions LLP',
                email: 'info@mkonstructions.com',
                phone: '9845678901',
                gstin: '29AABCM4444L1ZD',
                address: {
                    billing: { street: '88 Builder Colony', city: 'Belgaum', state: 'Karnataka', zipCode: '590001', country: 'India' },
                    shipping: { street: '88 Builder Colony', city: 'Belgaum', state: 'Karnataka', zipCode: '590001', country: 'India' },
                },
                openingBalance: 0,
                currentBalance: 0,
            },
        ];

        const customerMap = {};
        for (const c of customerData) {
            const existing = await Customer.findOne({ name: c.name, tenantId });
            if (!existing) {
                const created = await Customer.create({ ...c, tenantId });
                customerMap[c.name] = created._id;
                log(`Customer created: ${c.name}`);
            } else {
                customerMap[c.name] = existing._id;
                warn(`Customer already exists: ${c.name}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 8: Customer Ledger — Opening Balance Entries
        // ══════════════════════════════════════════════════════
        section('Step 8 — Customer Ledger (Opening Balances)');

        const openingLedgerData = [
            { customerName: 'Arjun Traders',      amount: 15000 },
            { customerName: 'Suresh Enterprises',  amount: 8500  },
        ];
        for (const entry of openingLedgerData) {
            const cId = customerMap[entry.customerName];
            const exists = await CustomerLedger.findOne({ customer: cId, type: 'opening', tenantId });
            if (!exists) {
                await CustomerLedger.create({
                    tenantId,
                    customer: cId,
                    type: 'opening',
                    refType: 'Manual',
                    date: new Date('2026-01-01'),
                    description: `Opening Balance for ${entry.customerName}`,
                    debit: entry.amount,
                    credit: 0,
                    balance: entry.amount,
                    paymentMode: 'other',
                    createdBy: userId,
                });
                log(`Opening balance ledger created: ${entry.customerName} — ₹${entry.amount}`);
            } else {
                warn(`Opening balance already exists: ${entry.customerName}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 9: Purchase Orders
        // ══════════════════════════════════════════════════════
        section('Step 9 — Purchase Orders');

        const poData = [
            {
                orderNumber: 'PO-001',
                vendor: 'Ravi Supplies',
                status: 'received',
                orderDate: new Date('2026-03-01'),
                expectedDeliveryDate: new Date('2026-03-10'),
                notes: 'First batch of laptops and printers',
                items: [
                    { itemName: 'Dell Laptop 15"',     quantity: 25, price: 45000 },
                    { itemName: 'HP Printer LaserJet', quantity: 10, price: 12000 },
                ],
            },
            {
                orderNumber: 'PO-002',
                vendor: 'Global Tech',
                status: 'received',
                orderDate: new Date('2026-03-05'),
                expectedDeliveryDate: new Date('2026-03-15'),
                notes: 'Monitors and drill machines batch',
                items: [
                    { itemName: 'Samsung Monitor 24"', quantity: 15, price: 8500  },
                    { itemName: 'Drill Machine',        quantity: 12, price: 1800  },
                ],
            },
        ];

        const poMap = {};
        for (const po of poData) {
            const exists = await PurchaseOrder.findOne({ orderNumber: po.orderNumber, tenantId });
            if (!exists) {
                const created = await PurchaseOrder.create({
                    orderNumber: po.orderNumber,
                    tenantId,
                    vendor: vendorMap[po.vendor],
                    status: po.status,
                    orderDate: po.orderDate,
                    expectedDeliveryDate: po.expectedDeliveryDate,
                    notes: po.notes,
                    totalAmount: po.items.reduce((s, i) => s + i.quantity * i.price, 0),
                    user: userId,
                    items: po.items.map(i => ({
                        item: itemMap[i.itemName],
                        name: i.itemName,
                        quantity: i.quantity,
                        boxCount: 0,
                        sqFtPerPc: 0,
                        totalSqFt: 0,
                        price: i.price,
                        total: i.quantity * i.price,
                    })),
                });
                poMap[po.orderNumber] = created._id;
                log(`Purchase Order created: ${po.orderNumber} (${po.status})`);
            } else {
                poMap[po.orderNumber] = exists._id;
                warn(`Purchase Order already exists: ${po.orderNumber}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 10: Inward Transactions (stock receipt from POs)
        // ══════════════════════════════════════════════════════
        section('Step 10 — Inward Transactions (stock receipt)');

        const inwardTxData = [
            { itemName: 'Dell Laptop 15"',     qty: 25, prevQty: 0,  newQty: 25,  ref: 'PO-001' },
            { itemName: 'HP Printer LaserJet', qty: 10, prevQty: 0,  newQty: 10,  ref: 'PO-001' },
            { itemName: 'Samsung Monitor 24"', qty: 15, prevQty: 0,  newQty: 15,  ref: 'PO-002' },
            { itemName: 'Drill Machine',        qty: 12, prevQty: 0,  newQty: 12,  ref: 'PO-002' },
        ];
        for (const tx of inwardTxData) {
            const exists = await Transaction.findOne({ item: itemMap[tx.itemName], type: 'inward', referenceOrder: tx.ref, tenantId });
            if (!exists) {
                await Transaction.create({
                    item: itemMap[tx.itemName],
                    type: 'inward',
                    quantity: tx.qty,
                    damagedQuantity: 0,
                    reason: 'Purchase Order Receipt',
                    referenceOrder: tx.ref,
                    user: userId,
                    previousQuantity: tx.prevQty,
                    newQuantity: tx.newQty,
                    notes: `Stock received against ${tx.ref}`,
                    tenantId,
                });
                log(`Inward transaction: ${tx.itemName} +${tx.qty} (ref: ${tx.ref})`);
            } else {
                warn(`Inward transaction already exists: ${tx.itemName} / ${tx.ref}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 11: Quotations
        // ══════════════════════════════════════════════════════
        section('Step 11 — Quotations');

        const quotationData = [
            {
                quotationNumber: 'QUO-001',
                customer: 'Arjun Traders',
                status: 'converted',
                quotationDate: new Date('2026-03-20'),
                validUntil: new Date('2026-04-20'),
                notes: 'Quote for laptops and monitors',
                items: [
                    { itemName: 'Dell Laptop 15"',     quantity: 2, price: 55000 },
                    { itemName: 'Samsung Monitor 24"', quantity: 3, price: 11000 },
                ],
            },
            {
                quotationNumber: 'QUO-002',
                customer: 'Priya Retail',
                status: 'sent',
                quotationDate: new Date('2026-04-01'),
                validUntil: new Date('2026-05-01'),
                notes: 'Furniture requirement for new office',
                items: [
                    { itemName: 'Office Desk 4ft',  quantity: 2, price: 6500 },
                    { itemName: 'Executive Chair',   quantity: 4, price: 5000 },
                ],
            },
            {
                quotationNumber: 'QUO-003',
                customer: 'MK Constructions',
                status: 'draft',
                quotationDate: new Date('2026-04-15'),
                validUntil: new Date('2026-05-15'),
                notes: 'Hardware tools for site work',
                items: [
                    { itemName: 'Hammer',        quantity: 5, price: 450 },
                    { itemName: 'Drill Machine', quantity: 2, price: 2800 },
                ],
            },
        ];

        const quoMap = {};
        for (const q of quotationData) {
            const exists = await Quotation.findOne({ quotationNumber: q.quotationNumber, tenantId });
            if (!exists) {
                const lineItems = q.items.map(i => ({
                    item: itemMap[i.itemName],
                    name: i.itemName,
                    quantity: i.quantity,
                    price: i.price,
                    total: i.quantity * i.price,
                    primaryQty: i.quantity,
                    secondaryQty: 0,
                    unitLabel: 'units',
                    rateLabel: 'per unit',
                    billingUnit: 'pieces',
                    stockQty: i.quantity,
                    stockUnit: 'pieces',
                }));
                const itemsTotal = lineItems.reduce((s, i) => s + i.total, 0);
                const taxAmount = Math.round(itemsTotal * 0.18);
                const totalAmount = itemsTotal + taxAmount;

                const created = await Quotation.create({
                    quotationNumber: q.quotationNumber,
                    tenantId,
                    customer: customerMap[q.customer],
                    status: q.status,
                    quotationDate: q.quotationDate,
                    validUntil: q.validUntil,
                    notes: q.notes,
                    user: userId,
                    items: lineItems,
                    itemsTotal,
                    taxRate: 18,
                    taxAmount,
                    loadingCharges: 0,
                    transportCharges: 0,
                    discountAmount: 0,
                    oldBalance: 0,
                    totalAmount,
                });
                quoMap[q.quotationNumber] = created._id;
                log(`Quotation created: ${q.quotationNumber} → ${q.customer} (${q.status}) — ₹${totalAmount}`);
            } else {
                quoMap[q.quotationNumber] = exists._id;
                warn(`Quotation already exists: ${q.quotationNumber}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 12: Sales Orders (Invoices)
        // ══════════════════════════════════════════════════════
        section('Step 12 — Sales Orders / Invoices');

        const soData = [
            {
                orderNumber: 'INV-001',
                customer: 'Arjun Traders',
                status: 'invoiced',
                quotationRef: 'QUO-001',
                orderDate: new Date('2026-03-22'),
                notes: 'Converted from QUO-001',
                items: [
                    { itemName: 'Dell Laptop 15"',     quantity: 2, price: 55000 },
                    { itemName: 'Samsung Monitor 24"', quantity: 3, price: 11000 },
                ],
                loadingCharges: 500,
                transportCharges: 1000,
                advanceAmount: 50000,
                oldBalance: 15000,
            },
            {
                orderNumber: 'INV-002',
                customer: 'Suresh Enterprises',
                status: 'confirmed',
                quotationRef: null,
                orderDate: new Date('2026-04-10'),
                notes: 'Direct order for office consumables',
                items: [
                    { itemName: 'A4 Paper Ream',    quantity: 50, price: 350  },
                    { itemName: 'Toner Cartridge',   quantity: 3,  price: 1400 },
                ],
                loadingCharges: 0,
                transportCharges: 200,
                advanceAmount: 10000,
                oldBalance: 8500,
            },
            {
                orderNumber: 'INV-003',
                customer: 'Priya Retail',
                status: 'dispatched',
                quotationRef: null,
                orderDate: new Date('2026-04-18'),
                notes: 'Chair order — direct sale',
                items: [
                    { itemName: 'Executive Chair', quantity: 2, price: 5000 },
                ],
                loadingCharges: 0,
                transportCharges: 500,
                advanceAmount: 5000,
                oldBalance: 0,
            },
        ];

        const soMap = {};
        for (const so of soData) {
            const exists = await SalesOrder.findOne({ orderNumber: so.orderNumber, tenantId });
            if (!exists) {
                const lineItems = so.items.map(i => ({
                    item: itemMap[i.itemName],
                    name: i.itemName,
                    quantity: i.quantity,
                    price: i.price,
                    total: i.quantity * i.price,
                    billingUnit: 'pieces',
                    stockQty: i.quantity,
                    stockUnit: 'pieces',
                }));
                const itemsTotal = lineItems.reduce((s, i) => s + i.total, 0);
                const taxAmount = Math.round(itemsTotal * 0.18);
                const totalAmount =
                    itemsTotal +
                    (so.loadingCharges || 0) +
                    (so.transportCharges || 0) +
                    taxAmount +
                    (so.oldBalance || 0) -
                    (so.advanceAmount || 0);

                const created = await SalesOrder.create({
                    orderNumber: so.orderNumber,
                    tenantId,
                    customer: customerMap[so.customer],
                    status: so.status,
                    orderDate: so.orderDate,
                    notes: so.notes,
                    user: userId,
                    quotationRef: so.quotationRef ? quoMap[so.quotationRef] : null,
                    quotationNumber: so.quotationRef || null,
                    items: lineItems,
                    itemsTotal,
                    taxAmount,
                    loadingCharges: so.loadingCharges || 0,
                    transportCharges: so.transportCharges || 0,
                    oldBalance: so.oldBalance || 0,
                    advanceAmount: so.advanceAmount || 0,
                    totalAmount,
                });
                soMap[so.orderNumber] = created._id;
                log(`Sales Order created: ${so.orderNumber} → ${so.customer} (${so.status}) — ₹${totalAmount}`);
            } else {
                soMap[so.orderNumber] = exists._id;
                warn(`Sales Order already exists: ${so.orderNumber}`);
            }
        }

        // Update QUO-001 convertedToInvoice reference
        if (quoMap['QUO-001'] && soMap['INV-001']) {
            await Quotation.findByIdAndUpdate(quoMap['QUO-001'], {
                convertedToInvoice: soMap['INV-001'],
                convertedAt: new Date('2026-03-22'),
            });
            log('QUO-001 linked to INV-001 (converted)');
        }

        // ══════════════════════════════════════════════════════
        // STEP 13: Dispatches
        // ══════════════════════════════════════════════════════
        section('Step 13 — Dispatches');

        const dispatchData = [
            {
                dispatchNumber: 'DISP-001',
                order: 'INV-001',
                vehicleNumber: 'TN09AB1234',
                driverPhone: '9000000001',
                dispatchDate: new Date('2026-03-25'),
                notes: 'Dispatched with verified stock',
                items: [
                    { itemName: 'Dell Laptop 15"',     quantity: 2, unit: 'Pcs' },
                    { itemName: 'Samsung Monitor 24"', quantity: 3, unit: 'Pcs' },
                ],
            },
            {
                dispatchNumber: 'DISP-002',
                order: 'INV-003',
                vehicleNumber: 'KA01CD5678',
                driverPhone: '9000000002',
                dispatchDate: new Date('2026-04-20'),
                notes: 'Chair delivery to Priya Retail',
                items: [
                    { itemName: 'Executive Chair', quantity: 2, unit: 'Pcs' },
                ],
            },
        ];

        for (const d of dispatchData) {
            const exists = await Dispatch.findOne({ dispatchNumber: d.dispatchNumber, tenantId });
            if (!exists) {
                await Dispatch.create({
                    dispatchNumber: d.dispatchNumber,
                    tenantId,
                    order: soMap[d.order],
                    vehicleNumber: d.vehicleNumber,
                    driverPhone: d.driverPhone,
                    dispatchDate: d.dispatchDate,
                    notes: d.notes,
                    status: 'dispatched',
                    createdBy: userId,
                    items: d.items.map(i => ({
                        item: itemMap[i.itemName],
                        quantity: i.quantity,
                        unit: i.unit,
                    })),
                });
                log(`Dispatch created: ${d.dispatchNumber} for ${d.order}`);
            } else {
                warn(`Dispatch already exists: ${d.dispatchNumber}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 14: Outward Transactions (stock deducted via dispatches)
        // ══════════════════════════════════════════════════════
        section('Step 14 — Outward Transactions (stock deduction)');

        const outwardTxData = [
            { itemName: 'Dell Laptop 15"',     qty: 2, prevQty: 25, newQty: 23, ref: 'INV-001' },
            { itemName: 'Samsung Monitor 24"', qty: 3, prevQty: 15, newQty: 12, ref: 'INV-001' },
            { itemName: 'Executive Chair',     qty: 2, prevQty: 20, newQty: 18, ref: 'INV-003' },
        ];
        for (const tx of outwardTxData) {
            const exists = await Transaction.findOne({ item: itemMap[tx.itemName], type: 'outward', referenceOrder: tx.ref, tenantId });
            if (!exists) {
                await Transaction.create({
                    item: itemMap[tx.itemName],
                    type: 'outward',
                    quantity: tx.qty,
                    damagedQuantity: 0,
                    reason: 'Sales Order Dispatch',
                    referenceOrder: tx.ref,
                    user: userId,
                    previousQuantity: tx.prevQty,
                    newQuantity: tx.newQty,
                    notes: `Stock dispatched against ${tx.ref}`,
                    tenantId,
                });
                // Update actual item quantity
                await Item.findByIdAndUpdate(itemMap[tx.itemName], { $inc: { quantity: -tx.qty } });
                log(`Outward transaction: ${tx.itemName} -${tx.qty} (ref: ${tx.ref})`);
            } else {
                warn(`Outward transaction already exists: ${tx.itemName} / ${tx.ref}`);
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 15: Customer Ledger — Bill & Payment Entries
        // ══════════════════════════════════════════════════════
        section('Step 15 — Customer Ledger (Bills & Payments)');

        // INV-001 bill for Arjun Traders
        const inv001 = await SalesOrder.findOne({ orderNumber: 'INV-001', tenantId });
        if (inv001) {
            const billExists = await CustomerLedger.findOne({ refId: inv001._id, type: 'bill', tenantId });
            if (!billExists) {
                const runningBal = 15000 + inv001.totalAmount; // prev balance + new bill
                await CustomerLedger.create({
                    tenantId,
                    customer: customerMap['Arjun Traders'],
                    date: inv001.orderDate,
                    type: 'bill',
                    refType: 'SalesOrder',
                    refId: inv001._id,
                    refNumber: 'INV-001',
                    description: 'Invoice INV-001',
                    debit: inv001.totalAmount,
                    credit: 0,
                    balance: runningBal,
                    paymentMode: 'other',
                    createdBy: userId,
                });
                log(`Ledger bill entry: Arjun Traders — INV-001 ₹${inv001.totalAmount}`);

                // Advance payment received
                const payBal = runningBal - 50000;
                await CustomerLedger.create({
                    tenantId,
                    customer: customerMap['Arjun Traders'],
                    date: new Date('2026-03-22'),
                    type: 'payment',
                    refType: 'Manual',
                    refNumber: 'INV-001',
                    description: 'Advance payment for INV-001',
                    debit: 0,
                    credit: 50000,
                    balance: payBal,
                    paymentMode: 'bank_transfer',
                    createdBy: userId,
                });
                log(`Ledger payment: Arjun Traders — ₹50,000 advance`);
            } else {
                warn('INV-001 bill ledger already exists');
            }
        }

        // INV-002 bill for Suresh Enterprises
        const inv002 = await SalesOrder.findOne({ orderNumber: 'INV-002', tenantId });
        if (inv002) {
            const billExists = await CustomerLedger.findOne({ refId: inv002._id, type: 'bill', tenantId });
            if (!billExists) {
                const runningBal = 8500 + inv002.totalAmount;
                await CustomerLedger.create({
                    tenantId,
                    customer: customerMap['Suresh Enterprises'],
                    date: inv002.orderDate,
                    type: 'bill',
                    refType: 'SalesOrder',
                    refId: inv002._id,
                    refNumber: 'INV-002',
                    description: 'Invoice INV-002',
                    debit: inv002.totalAmount,
                    credit: 0,
                    balance: runningBal,
                    paymentMode: 'other',
                    createdBy: userId,
                });
                log(`Ledger bill entry: Suresh Enterprises — INV-002 ₹${inv002.totalAmount}`);
            } else {
                warn('INV-002 bill ledger already exists');
            }
        }

        // ══════════════════════════════════════════════════════
        // STEP 16: Counters
        // ══════════════════════════════════════════════════════
        section('Step 16 — Counters');

        const counters = [
            { id: 'quotation',     seq: 3 },
            { id: 'salesorder',    seq: 3 },
            { id: 'purchaseorder', seq: 2 },
            { id: 'dispatch',      seq: 2 },
        ];
        for (const c of counters) {
            await Counter.findOneAndUpdate(
                { id: c.id, tenantId },
                { $max: { seq: c.seq } },
                { upsert: true, new: true }
            );
            log(`Counter set: ${c.id} → seq ${c.seq}`);
        }

        // ══════════════════════════════════════════════════════
        // DONE
        // ══════════════════════════════════════════════════════
        console.log('\n\n🎉 Demo seed completed successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  Login Email   : srinath@techath.com');
        console.log('  Password      : admin123');
        console.log('  Tenant        :', tenant.businessName);
        console.log('');
        console.log('  Seeded:');
        console.log('   • 1 Settings document');
        console.log('   • 2 Locations');
        console.log('   • 5 Categories');
        console.log('   • 3 Vendors');
        console.log('   • 10 Inventory Items');
        console.log('   • 4 Customers  (2 with opening balances)');
        console.log('   • 2 Customer Ledger opening entries');
        console.log('   • 2 Purchase Orders (received)');
        console.log('   • 4 Inward Transactions');
        console.log('   • 3 Quotations (draft / sent / converted)');
        console.log('   • 3 Sales Orders (invoiced / confirmed / dispatched)');
        console.log('   • 2 Dispatches');
        console.log('   • 3 Outward Transactions');
        console.log('   • Ledger bill + payment entries');
        console.log('   • 4 Counters');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Seed failed:', err);
        process.exit(1);
    }
};

seedDemo();
