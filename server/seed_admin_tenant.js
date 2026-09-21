import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { appConn, coreConn } from "./config/db.js";
import User from "./models/User.js";
import Tenant from "./models/Tenant.js";
import Category from "./models/Category.js";
import Item from "./models/Item.js";
import Customer from "./models/Customer.js";
import Vendor from "./models/Vendor.js";
import Quotation from "./models/Quotation.js";
import SalesOrder from "./models/SalesOrder.js";
import Setting from "./models/Setting.js";
import Transaction from "./models/Transaction.js";

const TARGET_EMAIL = "admin@inventory.com";

async function seedAdminTenant() {
    try {
        console.log("Waiting for DB connections...");
        await Promise.all([
            new Promise(resolve => appConn.readyState === 1 ? resolve() : appConn.once("open", resolve)),
            new Promise(resolve => coreConn.readyState === 1 ? resolve() : coreConn.once("open", resolve))
        ]);
        console.log("DB connections established.");

        // 1. Find or create the admin user
        let user = await User.findOne({ email: TARGET_EMAIL });
        if (!user) {
            console.log(`User not found. Creating...`);
            user = new User({
                name: "Admin User",
                email: TARGET_EMAIL,
                password: "admin123",
                role: "admin",
                isActive: true,
                menuAccess: "all",
                appRoles: { inventory: "admin", crm: null, proposal: null, hr: null, task: null, billing: null, whatsapp: null },
            });
            await user.save();
        } else {
            if (!user.appRoles?.inventory || user.appRoles.inventory === "none" || user.appRoles.inventory === "") {
                user.appRoles = { ...user.appRoles, inventory: "admin" };
                await user.save();
            }
            console.log(`Found user: ${TARGET_EMAIL}`);
        }

        // 2. Find or create Tenant
        let tenant;
        if (user.tenantId) {
            tenant = await Tenant.findById(user.tenantId);
        } else {
            tenant = await Tenant.findOne({ slug: "main-tenant" });
            if (!tenant) {
                tenant = new Tenant({
                    businessName: "Main Tiles Business",
                    slug: "main-tenant",
                    contactEmail: TARGET_EMAIL,
                    status: "Active",
                    apps: [{ name: "inventory", enabled: true }],
                    owner: user._id,
                });
                await tenant.save();
            }
            user.tenantId = tenant._id;
            await user.save();
        }

        const tenantId = tenant._id;
        console.log(`Tenant: "${tenant.businessName}" (${tenantId})`);

        // 3. Clear old data
        console.log("Clearing old data...");
        await Promise.all([
            Category.deleteMany({ tenantId }),
            Item.deleteMany({ tenantId }),
            Customer.deleteMany({ tenantId }),
            Vendor.deleteMany({ tenantId }),
            Quotation.deleteMany({ tenantId }),
            SalesOrder.deleteMany({ tenantId }),
            Setting.deleteMany({ tenantId }),
            Transaction.deleteMany({ tenantId }),
        ]);
        console.log("Old data cleared.");

        // 4. Seed Settings — TILES INDUSTRY
        console.log("Seeding Settings (Tiles Industry)...");
        await Setting.create({
            tenantId,
            companyName: "Main Tiles Business",
            address: "123, Tile Market, Chennai - 600001",
            phone1: "9876543210",
            gstNumber: "33AAAAA0000A1Z5",
            invoicePrefix: "INV",
            estimatePrefix: "EST",
            industry: "tiles",
            unitConfig: {
                quantityBasis: "sqft",
                secondaryUnit: "boxes",
                rateBasis: "per_sqft",
                quantityLabel: "SqFt",
                secondaryLabel: "Box",
                rateLabel: "Rate (SqFt)",
            },
            documentConfig: {
                quotationPrefix: "QUO",
                quotationCounter: 0,
                currency: "INR",
                currencySymbol: "Rs.",
                taxLabel: "GST",
                defaultTaxRate: 18,
            },
            branding: {
                tagline: "Quality Tiles, Best Prices",
                email: TARGET_EMAIL,
                bankName: "State Bank of India",
                accountNumber: "1234567890",
                ifscCode: "SBIN0001234",
                branchName: "Chennai Main Branch",
                termsAndConditions: "1. Goods once sold will not be taken back.\n2. No responsibility for breakages after delivery.\n3. E. & O.E.",
            },
        });
        console.log("Settings seeded.");

        // 5. Seed Categories (Tiles specific)
        console.log("Seeding Categories...");
        const [floorTiles, wallTiles, outdoorTiles, sanitaryWare, accessories] =
            await Category.insertMany([
                { name: "Floor Tiles", description: "Vitrified and ceramic floor tiles", tenantId },
                { name: "Wall Tiles", description: "Ceramic and digital wall tiles", tenantId },
                { name: "Outdoor / Parking Tiles", description: "Anti-skid and heavy duty outdoor tiles", tenantId },
                { name: "Sanitary Ware", description: "Wash basins, commodes, shower panels", tenantId },
                { name: "Accessories", description: "Tile adhesives, grouts, spacers", tenantId },
            ]);
        console.log("5 categories created.");

        // 6. Seed Items (Tiles specific — with sqft/box/pcs data)
        console.log("Seeding Items...");
        // Each tile: pcsPerBox * sqFtPerPc = sqft per box
        // quantity = number of boxes in stock
        const itemsData = [
            {
                name: "Kajaria Vitrified Floor 600x600",
                brand: "Kajaria",
                size: "600x600 mm",
                category: floorTiles._id,
                pcsPerBox: 4,
                sqFtPerPc: 3.875,   // 600x600mm = ~3.875 sqft per pc => 1 box = 15.5 sqft
                quantity: 120,       // 120 boxes
                price: 58,           // Rs per sqft
                purchasePrice: 42,
                minStockThreshold: 20,
                hsn: "6907",
                location: "Main Warehouse",
                tenantId,
            },
            {
                name: "RAK Double Charged Vitrified 800x800",
                brand: "RAK",
                size: "800x800 mm",
                category: floorTiles._id,
                pcsPerBox: 3,
                sqFtPerPc: 6.889,   // 800x800mm = ~6.889 sqft per pc => 1 box = ~20.67 sqft
                quantity: 80,
                price: 75,
                purchasePrice: 55,
                minStockThreshold: 15,
                hsn: "6907",
                location: "Main Warehouse",
                tenantId,
            },
            {
                name: "Somany Digital Wall Tile 300x450",
                brand: "Somany",
                size: "300x450 mm",
                category: wallTiles._id,
                pcsPerBox: 8,
                sqFtPerPc: 1.453,   // 300x450mm = ~1.453 sqft per pc => 1 box = ~11.6 sqft
                quantity: 90,
                price: 42,
                purchasePrice: 30,
                minStockThreshold: 15,
                hsn: "6907",
                location: "Main Warehouse",
                tenantId,
            },
            {
                name: "Johnson Wall Tile 300x600",
                brand: "Johnson",
                size: "300x600 mm",
                category: wallTiles._id,
                pcsPerBox: 6,
                sqFtPerPc: 1.938,   // 300x600mm = ~1.938 sqft per pc => 1 box = ~11.6 sqft
                quantity: 75,
                price: 48,
                purchasePrice: 35,
                minStockThreshold: 10,
                hsn: "6907",
                location: "Showroom",
                tenantId,
            },
            {
                name: "Orient Anti-Skid Outdoor 400x400",
                brand: "Orient",
                size: "400x400 mm",
                category: outdoorTiles._id,
                pcsPerBox: 6,
                sqFtPerPc: 1.722,   // 400x400mm = ~1.722 sqft per pc => 1 box = ~10.3 sqft
                quantity: 60,
                price: 38,
                purchasePrice: 28,
                minStockThreshold: 10,
                hsn: "6907",
                location: "Main Warehouse",
                tenantId,
            },
            {
                name: "Parking Tile Heavy Duty 600x600",
                brand: "Nitco",
                size: "600x600 mm",
                category: outdoorTiles._id,
                pcsPerBox: 4,
                sqFtPerPc: 3.875,
                quantity: 45,
                price: 52,
                purchasePrice: 38,
                minStockThreshold: 8,
                hsn: "6907",
                location: "Main Warehouse",
                tenantId,
            },
            {
                name: "Hindware Table Top Wash Basin",
                brand: "Hindware",
                size: "Standard",
                category: sanitaryWare._id,
                pcsPerBox: 1,
                sqFtPerPc: 0,
                quantity: 15,
                price: 3200,
                purchasePrice: 2200,
                minStockThreshold: 3,
                hsn: "6910",
                location: "Showroom",
                tenantId,
            },
            {
                name: "Cera Wall Hung Commode",
                brand: "Cera",
                size: "Standard",
                category: sanitaryWare._id,
                pcsPerBox: 1,
                sqFtPerPc: 0,
                quantity: 10,
                price: 8500,
                purchasePrice: 6000,
                minStockThreshold: 2,
                hsn: "6910",
                location: "Showroom",
                tenantId,
            },
            {
                name: "Tile Adhesive White (20kg Bag)",
                brand: "Weber",
                size: "20 kg",
                category: accessories._id,
                pcsPerBox: 1,
                sqFtPerPc: 0,
                quantity: 50,
                price: 420,
                purchasePrice: 300,
                minStockThreshold: 10,
                hsn: "3214",
                location: "Store Room",
                tenantId,
            },
            {
                name: "Tile Grout Sanded (1kg)",
                brand: "Laticrete",
                size: "1 kg",
                category: accessories._id,
                pcsPerBox: 1,
                sqFtPerPc: 0,
                quantity: 80,
                price: 180,
                purchasePrice: 120,
                minStockThreshold: 15,
                hsn: "3214",
                location: "Store Room",
                tenantId,
            },
        ];

        const createdItems = await Item.insertMany(itemsData);
        console.log(`${createdItems.length} items created.`);

        // 7. Opening Stock Transactions
        console.log("Seeding Opening Stock Transactions...");
        await Transaction.insertMany(
            createdItems.map(item => ({
                item: item._id,
                type: "inward",
                quantity: item.quantity,
                reason: "Opening Stock",
                user: user._id,
                previousQuantity: 0,
                newQuantity: item.quantity,
                tenantId,
            }))
        );
        console.log("Opening stock transactions seeded.");

        // 8. Seed Customers (builder / contractor types)
        console.log("Seeding Customers...");
        const [cust1, cust2, cust3] = await Customer.insertMany([
            {
                name: "Apex Builders Ltd",
                phone: "9876543210",
                email: "apex@builders.com",
                companyName: "Apex Builders Ltd",
                gstin: "33BBBBB1111B1Z5",
                tenantId,
            },
            {
                name: "Rajesh Home Construction",
                phone: "9876543211",
                email: "rajesh@homeconstruct.com",
                companyName: "Rajesh Home Construction",
                tenantId,
            },
            {
                name: "Sri Lakshmi Interior Works",
                phone: "9123456789",
                email: "info@slinteriors.com",
                companyName: "Sri Lakshmi Interior Works",
                gstin: "33CCCCC2222C1Z5",
                tenantId,
            },
        ]);
        console.log("3 customers created.");

        // 9. Seed Vendors
        console.log("Seeding Vendors...");
        await Vendor.insertMany([
            { name: "Kajaria Ceramics Ltd", phone: "9000000001", email: "sales@kajaria.com", tenantId },
            { name: "Somany Ceramics Ltd",  phone: "9000000002", email: "b2b@somany.com",    tenantId },
            { name: "Hindware Ltd",         phone: "9000000003", email: "trade@hindware.com", tenantId },
        ]);
        console.log("3 vendors created.");

        // 10. Seed Quotations (tiles use sqft billing)
        console.log("Seeding Quotations...");
        const kajTile  = createdItems[0]; // Kajaria 600x600
        const somWall  = createdItems[2]; // Somany Wall

        // Kajaria: 1 box = pcsPerBox(4) * sqFtPerPc(3.875) = 15.5 sqft
        const kaj_sqft_per_box = kajTile.pcsPerBox * kajTile.sqFtPerPc;
        const quo1Boxes = 10;
        const quo1SqFt  = quo1Boxes * kaj_sqft_per_box;

        await Quotation.insertMany([
            {
                quotationNumber: "QUO-001",
                tenantId,
                customer: cust1._id,
                user: user._id,
                status: "sent",
                items: [{
                    item: kajTile._id,
                    name: kajTile.name,
                    brand: kajTile.brand,
                    size: kajTile.size,
                    quantity: quo1SqFt,
                    price: kajTile.price,
                    total: quo1SqFt * kajTile.price,
                    boxCount: quo1Boxes,
                    totalSqFt: quo1SqFt,
                    billingUnit: "sqft",
                    stockQty: quo1Boxes,
                    stockUnit: "boxes",
                }],
                itemsTotal: quo1SqFt * kajTile.price,
                totalAmount: quo1SqFt * kajTile.price,
            },
            {
                quotationNumber: "QUO-002",
                tenantId,
                customer: cust3._id,
                user: user._id,
                status: "draft",
                items: [{
                    item: somWall._id,
                    name: somWall.name,
                    brand: somWall.brand,
                    size: somWall.size,
                    quantity: 5 * somWall.pcsPerBox * somWall.sqFtPerPc,
                    price: somWall.price,
                    total: 5 * somWall.pcsPerBox * somWall.sqFtPerPc * somWall.price,
                    boxCount: 5,
                    totalSqFt: 5 * somWall.pcsPerBox * somWall.sqFtPerPc,
                    billingUnit: "sqft",
                    stockQty: 5,
                    stockUnit: "boxes",
                }],
                itemsTotal: 5 * somWall.pcsPerBox * somWall.sqFtPerPc * somWall.price,
                totalAmount: 5 * somWall.pcsPerBox * somWall.sqFtPerPc * somWall.price,
            },
        ]);
        console.log("2 quotations created.");

        // 11. Seed Sales Orders
        console.log("Seeding Sales Orders...");
        const rakTile  = createdItems[1]; // RAK 800x800
        const basin    = createdItems[6]; // Hindware Basin

        const so1Boxes = 15;
        const so1SqFt  = so1Boxes * rakTile.pcsPerBox * rakTile.sqFtPerPc;

        await SalesOrder.insertMany([
            {
                orderNumber: "INV-001",
                tenantId,
                customer: cust2._id,
                user: user._id,
                status: "confirmed",
                paymentStatus: "unpaid",
                items: [
                    {
                        item: rakTile._id,
                        name: rakTile.name,
                        brand: rakTile.brand,
                        size: rakTile.size,
                        quantity: so1SqFt,
                        price: rakTile.price,
                        total: so1SqFt * rakTile.price,
                        boxCount: so1Boxes,
                        totalSqFt: so1SqFt,
                        billingUnit: "sqft",
                        stockQty: so1Boxes,
                        stockUnit: "boxes",
                    },
                    {
                        item: basin._id,
                        name: basin.name,
                        brand: basin.brand,
                        size: basin.size,
                        quantity: 2,
                        price: basin.price,
                        total: 2 * basin.price,
                        boxCount: 2,
                        totalSqFt: 0,
                        billingUnit: "pieces",
                        stockQty: 2,
                        stockUnit: "pieces",
                    },
                ],
                itemsTotal: so1SqFt * rakTile.price + 2 * basin.price,
                totalAmount: so1SqFt * rakTile.price + 2 * basin.price,
            },
            {
                orderNumber: "INV-002",
                tenantId,
                customer: cust1._id,
                user: user._id,
                status: "delivered",
                paymentStatus: "paid",
                items: [{
                    item: kajTile._id,
                    name: kajTile.name,
                    brand: kajTile.brand,
                    size: kajTile.size,
                    quantity: 20 * kajTile.pcsPerBox * kajTile.sqFtPerPc,
                    price: kajTile.price,
                    total: 20 * kajTile.pcsPerBox * kajTile.sqFtPerPc * kajTile.price,
                    boxCount: 20,
                    totalSqFt: 20 * kajTile.pcsPerBox * kajTile.sqFtPerPc,
                    billingUnit: "sqft",
                    stockQty: 20,
                    stockUnit: "boxes",
                }],
                itemsTotal: 20 * kajTile.pcsPerBox * kajTile.sqFtPerPc * kajTile.price,
                totalAmount: 20 * kajTile.pcsPerBox * kajTile.sqFtPerPc * kajTile.price,
            },
            {
                orderNumber: "INV-003",
                tenantId,
                customer: cust3._id,
                user: user._id,
                status: "dispatched",
                paymentStatus: "unpaid",
                items: [{
                    item: somWall._id,
                    name: somWall.name,
                    brand: somWall.brand,
                    size: somWall.size,
                    quantity: 8 * somWall.pcsPerBox * somWall.sqFtPerPc,
                    price: somWall.price,
                    total: 8 * somWall.pcsPerBox * somWall.sqFtPerPc * somWall.price,
                    boxCount: 8,
                    totalSqFt: 8 * somWall.pcsPerBox * somWall.sqFtPerPc,
                    billingUnit: "sqft",
                    stockQty: 8,
                    stockUnit: "boxes",
                }],
                itemsTotal: 8 * somWall.pcsPerBox * somWall.sqFtPerPc * somWall.price,
                totalAmount: 8 * somWall.pcsPerBox * somWall.sqFtPerPc * somWall.price,
            },
        ]);
        console.log("3 sales orders created.");

        console.log("====================================================");
        console.log("Seeding completed — TILES INDUSTRY");
        console.log("====================================================");
        console.log(`  Login Email : ${TARGET_EMAIL}`);
        console.log(`  Password    : admin123`);
        console.log(`  Industry    : Tiles & Sanitary Ware`);
        console.log(`  Tenant      : ${tenant.businessName}`);
        console.log("----------------------------------------------------");
        console.log("  Data seeded:");
        console.log("    - 5 Categories (Floor, Wall, Outdoor, Sanitary, Accessories)");
        console.log("    - 10 Items (tiles with sqft/box, sanitary ware, accessories)");
        console.log("    - 3 Customers (builders / contractors)");
        console.log("    - 3 Vendors (Kajaria, Somany, Hindware)");
        console.log("    - 2 Quotations (sqft billed)");
        console.log("    - 3 Sales Orders (sqft billed)");
        console.log("====================================================");

        process.exit(0);
    } catch (error) {
        console.error("Seeding error:", error);
        process.exit(1);
    }
}

seedAdminTenant();
