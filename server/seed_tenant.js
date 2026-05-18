import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { appConn, coreConn } from './config/db.js';
import User from './models/User.js';
import Tenant from './models/Tenant.js';
import Category from './models/Category.js';
import Item from './models/Item.js';
import Customer from './models/Customer.js';
import Vendor from './models/Vendor.js';
import Quotation from './models/Quotation.js';
import SalesOrder from './models/SalesOrder.js';
import Setting from './models/Setting.js';
import HSN from './models/HSN.js';
import Size from './models/Size.js';
import Location from './models/Location.js';
import Transaction from './models/Transaction.js';
import VendorLedger from './models/VendorLedger.js';

const TARGET_EMAIL = 'srinath@techath.com';

async function seedData() {
    try {
        console.log(`Starting seed process for ${TARGET_EMAIL}...`);

        // Wait for DB connections to be fully open
        await Promise.all([
            new Promise(resolve => appConn.readyState === 1 ? resolve() : appConn.once('open', resolve)),
            new Promise(resolve => coreConn.readyState === 1 ? resolve() : coreConn.once('open', resolve))
        ]);

        console.log('Database connections established.');

        // 1. Find or create User and Tenant
        let user = await User.findOne({ email: TARGET_EMAIL });
        let tenant;

        if (!user) {
            console.log(`User ${TARGET_EMAIL} not found. Creating new User and Tenant...`);
            
            tenant = new Tenant({
                businessName: 'Techath Ceramics',
                slug: 'techath-ceramics',
                contactEmail: TARGET_EMAIL,
                status: 'Active'
            });
            await tenant.save();

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);

            user = new User({
                name: 'Srinath',
                email: TARGET_EMAIL,
                password: hashedPassword, // The pre-save hook might re-hash, but let's bypass pre-save by hashing here and skipping it or just let the model handle it
                role: 'super_admin',
                tenantId: tenant._id,
                termsAccepted: true
            });
            // To prevent double-hashing, we pass plain text to a new User instance if pre-save is active
            user.password = 'password123'; 
            await user.save();
            
            tenant.owner = user._id;
            await tenant.save();
            console.log(`Created new Tenant (ID: ${tenant._id}) and User.`);
        } else {
            console.log(`User ${TARGET_EMAIL} found.`);
            if (!user.tenantId) {
                tenant = new Tenant({
                    businessName: 'Srinath Enterprise',
                    slug: `srinath-${Date.now()}`,
                    contactEmail: TARGET_EMAIL,
                    status: 'Active',
                    owner: user._id
                });
                await tenant.save();
                user.tenantId = tenant._id;
                user.role = 'super_admin';
                await user.save();
                console.log(`Created new Tenant (ID: ${tenant._id}) for existing user.`);
            } else {
                tenant = await Tenant.findById(user.tenantId);
                console.log(`Using existing Tenant (ID: ${tenant._id}).`);
                
                // Ensure user is admin for testing
                if (user.role !== 'super_admin') {
                    user.role = 'super_admin';
                    await user.save();
                }
            }
        }

        const tenantId = tenant._id;

        // 2. Clear existing data for this tenant
        console.log('Cleaning up old data for this tenant...');
        await Promise.all([
            Category.deleteMany({ tenantId }),
            Item.deleteMany({ tenantId }),
            Customer.deleteMany({ tenantId }),
            Vendor.deleteMany({ tenantId }),
            Quotation.deleteMany({ tenantId }),
            SalesOrder.deleteMany({ tenantId }),
            Setting.deleteMany({ tenantId }),
            HSN.deleteMany({ tenantId }),
            Size.deleteMany({ tenantId }),
            Location.deleteMany({ tenantId }),
            Transaction.deleteMany({ tenantId }),
            VendorLedger.deleteMany({ tenantId })
        ]);

        // 3. Seed Settings (Force Tiles Industry)
        console.log('Seeding Settings...');
        await Setting.create({
            tenantId,
            companyName: tenant.businessName,
            industry: 'tiles',
            unitConfig: {
                quantityBasis: 'sqft',
                secondaryUnit: 'boxes',
                rateBasis: 'per_sqft',
                quantityLabel: 'SqFt',
                secondaryLabel: 'Box',
                rateLabel: 'Rate (SqFt)'
            }
        });

        // 4. Seed Categories, Locations, HSN, Sizes
        console.log('Seeding Categories, Locations, HSN, Sizes...');
        const floorTiles = await Category.create({ name: 'Floor Tiles', tenantId });
        const wallTiles = await Category.create({ name: 'Wall Tiles', tenantId });
        const sanitary = await Category.create({ name: 'Sanitary Ware', tenantId });

        const loc1 = await Location.create({ name: 'Main Warehouse', type: 'inventory', tenantId });
        const loc2 = await Location.create({ name: 'Showroom', type: 'inventory', tenantId });

        const hsn1 = await HSN.findOneAndUpdate({ code: '6907' }, { code: '6907', description: 'Ceramic tiles', gstRate: 18, tenantId }, { upsert: true, new: true });
        const hsn2 = await HSN.findOneAndUpdate({ code: '6910' }, { code: '6910', description: 'Ceramic sinks', gstRate: 18, tenantId }, { upsert: true, new: true });

        await Size.create({ name: '60x60 cm', width: 60, height: 60, unit: 'cm', tenantId });
        await Size.create({ name: '30x45 cm', width: 30, height: 45, unit: 'cm', tenantId });

        // 5. Seed Items
        console.log('Seeding Items...');
        const itemsToCreate = [
            {
                name: 'Kajaria Vitrified Floor',
                brand: 'Kajaria',
                size: '6x4 ft', // 6 ft x 4 ft = 24 sqft
                category: floorTiles._id,
                pcsPerBox: 10,
                sqFtPerPc: 24, // 1 piece = 24 sqft. So 1 box = 240 sqft.
                quantity: 100, // 100 boxes in stock
                price: 45, // Selling price per SqFt
                purchasePrice: 35,
                hsn: hsn1.code,
                location: loc1.name,
                tenantId,
                batches: [{ batchNumber: 'B1-KJ', quantity: 100, price: 45, purchasePrice: 35 }]
            },
            {
                name: 'Somany Ceramic Wall',
                brand: 'Somany',
                size: '30x45 cm', // cm (approx 1x1.5 ft = 1.5 sqft)
                category: wallTiles._id,
                pcsPerBox: 6,
                sqFtPerPc: 1.5, // 1 box = 9 sqft.
                quantity: 50, // boxes
                price: 35, // per SqFt
                purchasePrice: 25,
                hsn: hsn1.code,
                location: loc1.name,
                tenantId,
                batches: [{ batchNumber: 'B1-SM', quantity: 50, price: 35, purchasePrice: 25 }]
            },
            {
                name: 'Hindware Wash Basin (Table Top)',
                brand: 'Hindware',
                size: 'Standard',
                category: sanitary._id,
                pcsPerBox: 1,
                sqFtPerPc: 0, // Not a tile
                quantity: 20, // pieces
                price: 2500, // per Piece
                purchasePrice: 1800,
                hsn: hsn2.code,
                location: loc2.name,
                tenantId,
                batches: [{ batchNumber: 'B1-HW', quantity: 20, price: 2500, purchasePrice: 1800 }]
            }
        ];

        const createdItems = await Item.insertMany(itemsToCreate);
        const tileItem = createdItems[0];
        const sanitaryItem = createdItems[2];

        // Seed Transactions for initial stock (Inward Flow)
        console.log('Seeding Initial Stock Transactions...');
        await Transaction.insertMany(createdItems.map(item => ({
            item: item._id,
            type: 'inward',
            quantity: item.quantity,
            reason: 'Opening Stock',
            user: user._id,
            previousQuantity: 0,
            newQuantity: item.quantity,
            tenantId
        })));

        // 6. Seed Customers & Vendors
        console.log('Seeding Contacts...');
        const customer1 = await Customer.create({ name: 'Apex Builders Ltd', phone: '9876543210', tenantId });
        const customer2 = await Customer.create({ name: 'Rajesh Home Construction', phone: '9876543211', tenantId });
        
        const vendor1 = await Vendor.create({ name: 'Kajaria Ceramics Ltd', tenantId });

        // Seed Vendor Ledger opening balance
        console.log('Seeding Vendor Ledger...');
        await VendorLedger.create({
            tenantId,
            vendor: vendor1._id,
            type: 'opening',
            description: 'Opening Balance',
            credit: 50000,
            balance: 50000,
            createdBy: user._id
        });

        // 7. Seed Quotation
        console.log('Seeding Quotations...');
        const tileSqFtPerBox = tileItem.pcsPerBox * tileItem.sqFtPerPc;
        const qBoxCount = 4;
        const qTotalSqFt = qBoxCount * tileSqFtPerBox; 
        const qPrice = 45;
        const qTotal = qTotalSqFt * qPrice;

        await Quotation.create({
            quotationNumber: 'QUO-001',
            tenantId,
            customer: customer1._id,
            user: user._id,
            status: 'sent',
            items: [{
                item: tileItem._id,
                name: tileItem.name,
                brand: tileItem.brand,
                size: tileItem.size,
                quantity: qTotalSqFt, // Billed quantity (SqFt)
                price: qPrice, // Rate per SqFt
                total: qTotal,
                boxCount: 4,
                totalSqFt: qTotalSqFt,
                billingUnit: 'sqft',
                stockQty: 4,
                stockUnit: 'boxes'
            }],
            itemsTotal: qTotal,
            totalAmount: qTotal
        });

        // 8. Seed Sales Order
        console.log('Seeding Sales Orders...');
        const soBoxCount = 10;
        const soTotalSqFt = soBoxCount * tileSqFtPerBox; 
        const soPrice = 45;
        const soTotal1 = soTotalSqFt * soPrice;
        
        const soTotal2 = 2 * 2500; // 2 wash basins

        await SalesOrder.create({
            orderNumber: 'INV-001',
            tenantId,
            customer: customer2._id,
            user: user._id,
            status: 'confirmed',
            paymentStatus: 'unpaid',
            items: [
                {
                    item: tileItem._id,
                    name: tileItem.name,
                    brand: tileItem.brand,
                    size: tileItem.size,
                    quantity: soTotalSqFt,
                    price: soPrice,
                    total: soTotal1,
                    boxCount: 10,
                    totalSqFt: soTotalSqFt,
                    billingUnit: 'sqft',
                    stockQty: 10,
                    stockUnit: 'boxes'
                },
                {
                    item: sanitaryItem._id,
                    name: sanitaryItem.name,
                    brand: sanitaryItem.brand,
                    size: sanitaryItem.size,
                    quantity: 2,
                    price: 2500,
                    total: soTotal2,
                    boxCount: 2,
                    totalSqFt: 0,
                    billingUnit: 'pieces',
                    stockQty: 2,
                    stockUnit: 'pieces'
                }
            ],
            itemsTotal: soTotal1 + soTotal2,
            totalAmount: soTotal1 + soTotal2
        });

        console.log('✅ Seeding completed successfully!');
        console.log('----------------------------------------------------');
        console.log(`Login Email: ${TARGET_EMAIL}`);
        console.log(`Password: password123`);
        console.log('----------------------------------------------------');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error during seeding:', error);
        process.exit(1);
    }
}

seedData();
