import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { appConn, coreConn } from "./config/db.js";
import User from "./models/User.js";
import Item from "./models/Item.js";
import Party from "./models/Party.js";
import SalesOrder from "./models/SalesOrder.js";
import PurchaseOrder from "./models/PurchaseOrder.js";
import Quotation from "./models/Quotation.js";
import Ledger from "./models/Ledger.js";

const TARGET_EMAIL = "admin@inventory.com";

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

async function seed() {
    try {
        await Promise.all([
            new Promise(r => appConn.readyState === 1 ? r() : appConn.once("open", r)),
            new Promise(r => coreConn.readyState === 1 ? r() : coreConn.once("open", r))
        ]);
        console.log("DB connected.");

        const user = await User.findOne({ email: TARGET_EMAIL });
        const tenantId = user?.tenantId;
        if (!tenantId) { console.error("No tenantId"); process.exit(1); }

        // Fetch existing items
        const items = await Item.find({ tenantId });
        if (!items.length) { console.error("No items found. Run seed_admin_tenant.js first."); process.exit(1); }

        const kajTile  = items.find(i => i.name.includes("Kajaria"));
        const rakTile  = items.find(i => i.name.includes("RAK"));
        const somWall  = items.find(i => i.name.includes("Somany"));
        const johWall  = items.find(i => i.name.includes("Johnson"));
        const basin    = items.find(i => i.name.includes("Hindware"));
        const commode  = items.find(i => i.name.includes("Cera"));
        const adhesive = items.find(i => i.name.includes("Adhesive"));
        const grout    = items.find(i => i.name.includes("Grout"));
        const parking  = items.find(i => i.name.includes("Parking"));

        // -- Clear old parties + documents --------------------------------
        console.log("Clearing old Parties, Sales Orders, Purchase Orders, Quotations, Ledger...");
        await Promise.all([
            Party.deleteMany({ tenantId }),
            SalesOrder.deleteMany({ tenantId }),
            PurchaseOrder.deleteMany({ tenantId }),
            Quotation.deleteMany({ tenantId }),
            Ledger.deleteMany({ tenantId }),
        ]);
        console.log("Cleared.");

        // -- 1. CREATE PARTIES ---------------------------------------------
        console.log("Creating Parties...");
        const partiesData = [
            // Customer parties (buyers)
            {
                name: "Apex Builders Ltd",
                phone: "9876501001",
                email: "purchase@apexbuilders.com",
                companyName: "Apex Builders Ltd",
                gstin: "33AABCA1234A1Z5",
                openingBalance: 25000,
                currentBalance: 25000,
                address: { billing: { street: "12, Anna Salai", city: "Chennai", state: "Tamil Nadu", zipCode: "600002", country: "India" } },
                tenantId,
            },
            {
                name: "Rajesh Home Construction",
                phone: "9876502002",
                email: "rajesh@homeconstruct.in",
                companyName: "Rajesh Home Construction",
                openingBalance: 0,
                currentBalance: 0,
                address: { billing: { street: "45, OMR Road", city: "Chennai", state: "Tamil Nadu", zipCode: "600097", country: "India" } },
                tenantId,
            },
            {
                name: "Sri Lakshmi Interior Works",
                phone: "9876503003",
                email: "info@slinteriors.com",
                companyName: "Sri Lakshmi Interior Works",
                gstin: "33BBBBC5678B1Z5",
                openingBalance: 10000,
                currentBalance: 10000,
                address: { billing: { street: "8, TTK Road", city: "Chennai", state: "Tamil Nadu", zipCode: "600018", country: "India" } },
                tenantId,
            },
            {
                name: "Greenfield Developers",
                phone: "9876504004",
                email: "purchase@greenfield.in",
                companyName: "Greenfield Developers Pvt Ltd",
                gstin: "33CCCCD9012C1Z5",
                openingBalance: 50000,
                currentBalance: 50000,
                address: { billing: { street: "32, Mount Road", city: "Chennai", state: "Tamil Nadu", zipCode: "600006", country: "India" } },
                tenantId,
            },
            {
                name: "Vignesh Tile Works",
                phone: "9876505005",
                email: "vignesh@tileworks.com",
                openingBalance: 0,
                currentBalance: 0,
                address: { billing: { street: "90, Poonamallee High Road", city: "Chennai", state: "Tamil Nadu", zipCode: "600056", country: "India" } },
                tenantId,
            },
            // Vendor / supplier parties (sellers to us)
            {
                name: "Kajaria Ceramics Ltd",
                phone: "9000101001",
                email: "trade@kajaria.com",
                companyName: "Kajaria Ceramics Ltd",
                gstin: "06AAACK1234A1Z5",
                openingBalance: 0,
                currentBalance: 0,
                address: { billing: { street: "Plot 5, Udyog Vihar", city: "Gurugram", state: "Haryana", zipCode: "122016", country: "India" } },
                tenantId,
            },
            {
                name: "Somany Ceramics Ltd",
                phone: "9000102002",
                email: "b2b@somany.com",
                companyName: "Somany Ceramics Ltd",
                gstin: "08AAACS5678B1Z5",
                openingBalance: 0,
                currentBalance: 0,
                address: { billing: { street: "6, Industrial Area", city: "Morbi", state: "Gujarat", zipCode: "363641", country: "India" } },
                tenantId,
            },
            {
                name: "Hindware Ltd",
                phone: "9000103003",
                email: "trade@hindware.com",
                companyName: "Hindware Ltd",
                gstin: "07AAACH9012C1Z5",
                openingBalance: 0,
                currentBalance: 0,
                address: { billing: { street: "2nd Floor, IFCI Tower", city: "New Delhi", state: "Delhi", zipCode: "110001", country: "India" } },
                tenantId,
            },
        ];

        const createdParties = await Party.insertMany(partiesData);
        const apexParty      = createdParties[0];
        const rajeshParty    = createdParties[1];
        const sriParty       = createdParties[2];
        const greenParty     = createdParties[3];
        const vigneshParty   = createdParties[4];
        const kajVendor      = createdParties[5];
        const somVendor      = createdParties[6];
        const hindVendor     = createdParties[7];
        console.log(`${createdParties.length} parties created.`);

        // -- Helper: sqft from boxes ---------------------------------------
        const sqft = (item, boxes) => boxes * item.pcsPerBox * item.sqFtPerPc;

        // -- 2. QUOTATIONS -------------------------------------------------
        console.log("Creating Quotations...");
        const q1SqFt = sqft(kajTile, 20);
        const q2SqFt = sqft(somWall, 12);
        const q3SqFt_kaj = sqft(kajTile, 30);
        const q3SqFt_som = sqft(somWall, 10);

        await Quotation.insertMany([
            {
                quotationNumber: "QUO-001",
                tenantId,
                customer: apexParty._id,
                user: user._id,
                status: "sent",
                orderDate: daysAgo(20),
                items: [
                    { item: kajTile._id, name: kajTile.name, brand: kajTile.brand, size: kajTile.size, quantity: q1SqFt, price: kajTile.price, total: q1SqFt * kajTile.price, boxCount: 20, totalSqFt: q1SqFt, billingUnit: "sqft", stockQty: 20, stockUnit: "boxes" },
                    { item: basin._id,   name: basin.name,   brand: basin.brand,   size: basin.size,   quantity: 2,       price: basin.price,   total: 2 * basin.price,       boxCount: 2,  totalSqFt: 0,       billingUnit: "pieces", stockQty: 2, stockUnit: "pieces" },
                ],
                itemsTotal: q1SqFt * kajTile.price + 2 * basin.price,
                totalAmount: q1SqFt * kajTile.price + 2 * basin.price,
            },
            {
                quotationNumber: "QUO-002",
                tenantId,
                customer: rajeshParty._id,
                user: user._id,
                status: "accepted",
                orderDate: daysAgo(18),
                items: [
                    { item: somWall._id, name: somWall.name, brand: somWall.brand, size: somWall.size, quantity: q2SqFt, price: somWall.price, total: q2SqFt * somWall.price, boxCount: 12, totalSqFt: q2SqFt, billingUnit: "sqft", stockQty: 12, stockUnit: "boxes" },
                ],
                itemsTotal: q2SqFt * somWall.price,
                totalAmount: q2SqFt * somWall.price,
            },
            {
                quotationNumber: "QUO-003",
                tenantId,
                customer: greenParty._id,
                user: user._id,
                status: "draft",
                orderDate: daysAgo(5),
                items: [
                    { item: kajTile._id, name: kajTile.name, brand: kajTile.brand, size: kajTile.size, quantity: q3SqFt_kaj, price: kajTile.price, total: q3SqFt_kaj * kajTile.price, boxCount: 30, totalSqFt: q3SqFt_kaj, billingUnit: "sqft", stockQty: 30, stockUnit: "boxes" },
                    { item: somWall._id, name: somWall.name, brand: somWall.brand, size: somWall.size, quantity: q3SqFt_som, price: somWall.price, total: q3SqFt_som * somWall.price, boxCount: 10, totalSqFt: q3SqFt_som, billingUnit: "sqft", stockQty: 10, stockUnit: "boxes" },
                ],
                itemsTotal: q3SqFt_kaj * kajTile.price + q3SqFt_som * somWall.price,
                totalAmount: q3SqFt_kaj * kajTile.price + q3SqFt_som * somWall.price,
            },
            {
                quotationNumber: "QUO-004",
                tenantId,
                customer: sriParty._id,
                user: user._id,
                status: "rejected",
                orderDate: daysAgo(30),
                items: [
                    { item: rakTile._id, name: rakTile.name, brand: rakTile.brand, size: rakTile.size, quantity: sqft(rakTile, 15), price: rakTile.price, total: sqft(rakTile, 15) * rakTile.price, boxCount: 15, totalSqFt: sqft(rakTile, 15), billingUnit: "sqft", stockQty: 15, stockUnit: "boxes" },
                ],
                itemsTotal: sqft(rakTile, 15) * rakTile.price,
                totalAmount: sqft(rakTile, 15) * rakTile.price,
            },
        ]);
        console.log("4 quotations created.");

        // -- 3. SALES ORDERS -----------------------------------------------
        console.log("Creating Sales Orders...");

        // INV-001: Apex - 25 boxes Kajaria + 3 basins (delivered, fully paid)
        const so1_sqft = sqft(kajTile, 25);
        const so1_total = so1_sqft * kajTile.price + 3 * basin.price;

        // INV-002: Rajesh - 12 boxes Somany wall (confirmed, unpaid)
        const so2_sqft = sqft(somWall, 12);

        // INV-003: Greenfield - 40 boxes Kajaria + 20 boxes RAK (dispatched, partially paid)
        const so3_sqft_kaj = sqft(kajTile, 40);
        const so3_sqft_rak = sqft(rakTile, 20);

        // INV-004: Sri Lakshmi - 8 boxes Johnson wall + grout (confirmed, unpaid)
        const so4_sqft_joh = sqft(johWall, 8);

        // INV-005: Vignesh - 10 boxes parking + adhesive (delivered, paid)
        const so5_sqft = sqft(parking, 10);

        // INV-006: Apex - commode + basin repeat order (confirmed, advance paid)
        const so6_total = 2 * commode.price + 4 * basin.price;

        const salesOrders = await SalesOrder.insertMany([
            {
                orderNumber: "INV-001",
                tenantId,
                party: apexParty._id,
                user: user._id,
                status: "delivered",
                paymentStatus: "paid",
                orderDate: daysAgo(25),
                items: [
                    { item: kajTile._id, name: kajTile.name, brand: kajTile.brand, size: kajTile.size, quantity: so1_sqft, price: kajTile.price, total: so1_sqft * kajTile.price, boxCount: 25, totalSqFt: so1_sqft, billingUnit: "sqft", stockQty: 25, stockUnit: "boxes" },
                    { item: basin._id,   name: basin.name,   brand: basin.brand,   size: basin.size,   quantity: 3, price: basin.price, total: 3 * basin.price, boxCount: 3, totalSqFt: 0, billingUnit: "pieces", stockQty: 3, stockUnit: "pieces" },
                ],
                itemsTotal: so1_total,
                totalAmount: so1_total,
            },
            {
                orderNumber: "INV-002",
                tenantId,
                party: rajeshParty._id,
                user: user._id,
                status: "confirmed",
                paymentStatus: "unpaid",
                orderDate: daysAgo(15),
                items: [
                    { item: somWall._id, name: somWall.name, brand: somWall.brand, size: somWall.size, quantity: so2_sqft, price: somWall.price, total: so2_sqft * somWall.price, boxCount: 12, totalSqFt: so2_sqft, billingUnit: "sqft", stockQty: 12, stockUnit: "boxes" },
                ],
                itemsTotal: so2_sqft * somWall.price,
                totalAmount: so2_sqft * somWall.price,
            },
            {
                orderNumber: "INV-003",
                tenantId,
                party: greenParty._id,
                user: user._id,
                status: "dispatched",
                paymentStatus: "partial",
                orderDate: daysAgo(12),
                advanceAmount: 30000,
                items: [
                    { item: kajTile._id, name: kajTile.name, brand: kajTile.brand, size: kajTile.size, quantity: so3_sqft_kaj, price: kajTile.price, total: so3_sqft_kaj * kajTile.price, boxCount: 40, totalSqFt: so3_sqft_kaj, billingUnit: "sqft", stockQty: 40, stockUnit: "boxes" },
                    { item: rakTile._id, name: rakTile.name, brand: rakTile.brand, size: rakTile.size, quantity: so3_sqft_rak, price: rakTile.price, total: so3_sqft_rak * rakTile.price, boxCount: 20, totalSqFt: so3_sqft_rak, billingUnit: "sqft", stockQty: 20, stockUnit: "boxes" },
                ],
                itemsTotal: so3_sqft_kaj * kajTile.price + so3_sqft_rak * rakTile.price,
                totalAmount: so3_sqft_kaj * kajTile.price + so3_sqft_rak * rakTile.price,
            },
            {
                orderNumber: "INV-004",
                tenantId,
                party: sriParty._id,
                user: user._id,
                status: "confirmed",
                paymentStatus: "unpaid",
                orderDate: daysAgo(8),
                items: [
                    { item: johWall._id,  name: johWall.name,  brand: johWall.brand,  size: johWall.size,  quantity: so4_sqft_joh, price: johWall.price, total: so4_sqft_joh * johWall.price, boxCount: 8, totalSqFt: so4_sqft_joh, billingUnit: "sqft", stockQty: 8, stockUnit: "boxes" },
                    { item: grout._id,    name: grout.name,    brand: grout.brand,    size: grout.size,    quantity: 10, price: grout.price, total: 10 * grout.price, boxCount: 10, totalSqFt: 0, billingUnit: "pieces", stockQty: 10, stockUnit: "pieces" },
                ],
                itemsTotal: so4_sqft_joh * johWall.price + 10 * grout.price,
                totalAmount: so4_sqft_joh * johWall.price + 10 * grout.price,
            },
            {
                orderNumber: "INV-005",
                tenantId,
                party: vigneshParty._id,
                user: user._id,
                status: "delivered",
                paymentStatus: "paid",
                orderDate: daysAgo(6),
                items: [
                    { item: parking._id,  name: parking.name,  brand: parking.brand,  size: parking.size,  quantity: so5_sqft, price: parking.price, total: so5_sqft * parking.price, boxCount: 10, totalSqFt: so5_sqft, billingUnit: "sqft", stockQty: 10, stockUnit: "boxes" },
                    { item: adhesive._id, name: adhesive.name, brand: adhesive.brand, size: adhesive.size, quantity: 5, price: adhesive.price, total: 5 * adhesive.price, boxCount: 5, totalSqFt: 0, billingUnit: "pieces", stockQty: 5, stockUnit: "pieces" },
                ],
                itemsTotal: so5_sqft * parking.price + 5 * adhesive.price,
                totalAmount: so5_sqft * parking.price + 5 * adhesive.price,
            },
            {
                orderNumber: "INV-006",
                tenantId,
                party: apexParty._id,
                user: user._id,
                status: "confirmed",
                paymentStatus: "partial",
                orderDate: daysAgo(3),
                advanceAmount: 10000,
                items: [
                    { item: commode._id, name: commode.name, brand: commode.brand, size: commode.size, quantity: 2, price: commode.price, total: 2 * commode.price, boxCount: 2, totalSqFt: 0, billingUnit: "pieces", stockQty: 2, stockUnit: "pieces" },
                    { item: basin._id,   name: basin.name,   brand: basin.brand,   size: basin.size,   quantity: 4, price: basin.price,  total: 4 * basin.price,  boxCount: 4, totalSqFt: 0, billingUnit: "pieces", stockQty: 4, stockUnit: "pieces" },
                ],
                itemsTotal: so6_total,
                totalAmount: so6_total,
            },
        ]);
        console.log(`${salesOrders.length} sales orders created.`);

        // -- 4. PURCHASE ORDERS --------------------------------------------
        console.log("Creating Purchase Orders...");

        const po1_sqft = sqft(kajTile, 50);
        const po2_sqft = sqft(somWall, 30);
        const po3_sqft_kaj = sqft(kajTile, 60);
        const po3_sqft_rak = sqft(rakTile, 25);

        const purchaseOrders = await PurchaseOrder.insertMany([
            {
                orderNumber: "PO-001",
                tenantId,
                party: kajVendor._id,
                user: user._id,
                status: "received",
                orderDate: daysAgo(40),
                items: [
                    { item: kajTile._id, name: kajTile.name, quantity: po1_sqft, price: kajTile.purchasePrice, total: po1_sqft * kajTile.purchasePrice, boxCount: 50, totalSqFt: po1_sqft, pcsPerBox: kajTile.pcsPerBox, sqFtPerPc: kajTile.sqFtPerPc, hsnCode: "6907", taxRate: 18, taxAmount: po1_sqft * kajTile.purchasePrice * 0.18 },
                ],
                itemsTotal: po1_sqft * kajTile.purchasePrice,
                taxRate: 18,
                taxAmount: po1_sqft * kajTile.purchasePrice * 0.18,
                totalAmount: po1_sqft * kajTile.purchasePrice * 1.18,
                partyBillNumber: "KAJ/2026/0891",
            },
            {
                orderNumber: "PO-002",
                tenantId,
                party: somVendor._id,
                user: user._id,
                status: "received",
                orderDate: daysAgo(30),
                items: [
                    { item: somWall._id, name: somWall.name, quantity: po2_sqft, price: somWall.purchasePrice, total: po2_sqft * somWall.purchasePrice, boxCount: 30, totalSqFt: po2_sqft, pcsPerBox: somWall.pcsPerBox, sqFtPerPc: somWall.sqFtPerPc, hsnCode: "6907", taxRate: 18, taxAmount: po2_sqft * somWall.purchasePrice * 0.18 },
                ],
                itemsTotal: po2_sqft * somWall.purchasePrice,
                taxRate: 18,
                taxAmount: po2_sqft * somWall.purchasePrice * 0.18,
                totalAmount: po2_sqft * somWall.purchasePrice * 1.18,
                partyBillNumber: "SOM/26/DEC/445",
            },
            {
                orderNumber: "PO-003",
                tenantId,
                party: kajVendor._id,
                user: user._id,
                status: "issued",
                orderDate: daysAgo(5),
                expectedDeliveryDate: daysAgo(-7),
                items: [
                    { item: kajTile._id, name: kajTile.name, quantity: po3_sqft_kaj, price: kajTile.purchasePrice, total: po3_sqft_kaj * kajTile.purchasePrice, boxCount: 60, totalSqFt: po3_sqft_kaj, pcsPerBox: kajTile.pcsPerBox, sqFtPerPc: kajTile.sqFtPerPc, hsnCode: "6907", taxRate: 18 },
                    { item: rakTile._id, name: rakTile.name, quantity: po3_sqft_rak, price: rakTile.purchasePrice, total: po3_sqft_rak * rakTile.purchasePrice, boxCount: 25, totalSqFt: po3_sqft_rak, pcsPerBox: rakTile.pcsPerBox, sqFtPerPc: rakTile.sqFtPerPc, hsnCode: "6907", taxRate: 18 },
                ],
                itemsTotal: po3_sqft_kaj * kajTile.purchasePrice + po3_sqft_rak * rakTile.purchasePrice,
                taxRate: 18,
                taxAmount: (po3_sqft_kaj * kajTile.purchasePrice + po3_sqft_rak * rakTile.purchasePrice) * 0.18,
                totalAmount: (po3_sqft_kaj * kajTile.purchasePrice + po3_sqft_rak * rakTile.purchasePrice) * 1.18,
            },
            {
                orderNumber: "PO-004",
                tenantId,
                party: hindVendor._id,
                user: user._id,
                status: "billed",
                orderDate: daysAgo(20),
                items: [
                    { item: basin._id,   name: basin.name,   quantity: 10, price: basin.purchasePrice,   total: 10 * basin.purchasePrice,   hsnCode: "6910", taxRate: 18, taxAmount: 10 * basin.purchasePrice * 0.18 },
                    { item: commode._id, name: commode.name, quantity: 5,  price: commode.purchasePrice, total: 5  * commode.purchasePrice, hsnCode: "6910", taxRate: 18, taxAmount: 5  * commode.purchasePrice * 0.18 },
                ],
                itemsTotal: 10 * basin.purchasePrice + 5 * commode.purchasePrice,
                taxRate: 18,
                taxAmount: (10 * basin.purchasePrice + 5 * commode.purchasePrice) * 0.18,
                totalAmount: (10 * basin.purchasePrice + 5 * commode.purchasePrice) * 1.18,
                partyBillNumber: "HW/2026/3321",
            },
        ]);
        console.log(`${purchaseOrders.length} purchase orders created.`);

        // -- 5. LEDGER ENTRIES (customer + vendor) -------------------------
        console.log("Creating Ledger entries...");
        const ledgerEntries = [];

        // Opening balances
        ledgerEntries.push(
            { tenantId, party: apexParty._id, type: "opening", refType: "Manual", description: "Opening Balance", debit: 25000, credit: 0, balance: 25000, date: daysAgo(60), createdBy: user._id },
            { tenantId, party: sriParty._id,  type: "opening", refType: "Manual", description: "Opening Balance", debit: 10000, credit: 0, balance: 10000, date: daysAgo(60), createdBy: user._id },
            { tenantId, party: greenParty._id, type: "opening", refType: "Manual", description: "Opening Balance", debit: 50000, credit: 0, balance: 50000, date: daysAgo(60), createdBy: user._id }
        );

        // Sales bills (customer debits)
        ledgerEntries.push(
            { tenantId, party: apexParty._id,    type: "bill",    refType: "SalesOrder", refId: salesOrders[0]._id, refNumber: "INV-001", description: "Invoice INV-001", debit: Math.round(so1_total),   credit: 0, balance: 25000 + Math.round(so1_total), date: daysAgo(25), createdBy: user._id },
            { tenantId, party: rajeshParty._id,  type: "bill",    refType: "SalesOrder", refId: salesOrders[1]._id, refNumber: "INV-002", description: "Invoice INV-002", debit: Math.round(so2_sqft * somWall.price), credit: 0, balance: Math.round(so2_sqft * somWall.price), date: daysAgo(15), createdBy: user._id },
            { tenantId, party: greenParty._id,   type: "bill",    refType: "SalesOrder", refId: salesOrders[2]._id, refNumber: "INV-003", description: "Invoice INV-003", debit: Math.round(so3_sqft_kaj * kajTile.price + so3_sqft_rak * rakTile.price), credit: 0, balance: 50000 + Math.round(so3_sqft_kaj * kajTile.price + so3_sqft_rak * rakTile.price), date: daysAgo(12), createdBy: user._id },
            { tenantId, party: sriParty._id,     type: "bill",    refType: "SalesOrder", refId: salesOrders[3]._id, refNumber: "INV-004", description: "Invoice INV-004", debit: Math.round(so4_sqft_joh * johWall.price + 10 * grout.price), credit: 0, balance: 10000 + Math.round(so4_sqft_joh * johWall.price + 10 * grout.price), date: daysAgo(8), createdBy: user._id },
            { tenantId, party: vigneshParty._id, type: "bill",    refType: "SalesOrder", refId: salesOrders[4]._id, refNumber: "INV-005", description: "Invoice INV-005", debit: Math.round(so5_sqft * parking.price + 5 * adhesive.price), credit: 0, balance: Math.round(so5_sqft * parking.price + 5 * adhesive.price), date: daysAgo(6), createdBy: user._id },
            { tenantId, party: apexParty._id,    type: "bill",    refType: "SalesOrder", refId: salesOrders[5]._id, refNumber: "INV-006", description: "Invoice INV-006", debit: Math.round(so6_total), credit: 0, balance: 0, date: daysAgo(3), createdBy: user._id }
        );

        // Payments received (customer credits)
        ledgerEntries.push(
            // INV-001 fully paid
            { tenantId, party: apexParty._id,    type: "payment", refType: "SalesOrder", refId: salesOrders[0]._id, refNumber: "INV-001", description: "Payment received for INV-001", debit: 0, credit: Math.round(so1_total),   balance: 25000, paymentMode: "bank_transfer", date: daysAgo(20), createdBy: user._id },
            // INV-003 advance
            { tenantId, party: greenParty._id,   type: "payment", refType: "SalesOrder", refId: salesOrders[2]._id, refNumber: "INV-003", description: "Advance payment for INV-003", debit: 0, credit: 30000, balance: 0, paymentMode: "upi", date: daysAgo(10), createdBy: user._id },
            // INV-005 fully paid
            { tenantId, party: vigneshParty._id, type: "payment", refType: "SalesOrder", refId: salesOrders[4]._id, refNumber: "INV-005", description: "Payment received for INV-005", debit: 0, credit: Math.round(so5_sqft * parking.price + 5 * adhesive.price), balance: 0, paymentMode: "cash", date: daysAgo(4), createdBy: user._id },
            // INV-006 advance
            { tenantId, party: apexParty._id,    type: "payment", refType: "SalesOrder", refId: salesOrders[5]._id, refNumber: "INV-006", description: "Advance payment for INV-006", debit: 0, credit: 10000, balance: 0, paymentMode: "upi", date: daysAgo(2), createdBy: user._id }
        );

        // Purchase bills (vendor credits - we owe them)
        ledgerEntries.push(
            { tenantId, party: kajVendor._id,  type: "bill", refType: "PurchaseOrder", refId: purchaseOrders[0]._id, refNumber: "PO-001", description: "Purchase PO-001 from Kajaria",  debit: 0, credit: Math.round(po1_sqft * kajTile.purchasePrice * 1.18), balance: Math.round(po1_sqft * kajTile.purchasePrice * 1.18), date: daysAgo(40), createdBy: user._id },
            { tenantId, party: somVendor._id,  type: "bill", refType: "PurchaseOrder", refId: purchaseOrders[1]._id, refNumber: "PO-002", description: "Purchase PO-002 from Somany",   debit: 0, credit: Math.round(po2_sqft * somWall.purchasePrice * 1.18), balance: Math.round(po2_sqft * somWall.purchasePrice * 1.18), date: daysAgo(30), createdBy: user._id },
            { tenantId, party: hindVendor._id, type: "bill", refType: "PurchaseOrder", refId: purchaseOrders[3]._id, refNumber: "PO-004", description: "Purchase PO-004 from Hindware", debit: 0, credit: Math.round((10 * basin.purchasePrice + 5 * commode.purchasePrice) * 1.18), balance: Math.round((10 * basin.purchasePrice + 5 * commode.purchasePrice) * 1.18), date: daysAgo(20), createdBy: user._id }
        );

        // Payment to vendors
        ledgerEntries.push(
            { tenantId, party: kajVendor._id, type: "payment", refType: "PurchaseOrder", refId: purchaseOrders[0]._id, refNumber: "PO-001", description: "Payment to Kajaria for PO-001", debit: Math.round(po1_sqft * kajTile.purchasePrice * 1.18), credit: 0, balance: 0, paymentMode: "bank_transfer", date: daysAgo(35), createdBy: user._id }
        );

        await Ledger.insertMany(ledgerEntries);
        console.log(`${ledgerEntries.length} ledger entries created.`);

        // -- Summary -------------------------------------------------------
        console.log("====================================================");
        console.log("Seeding complete!");
        console.log("====================================================");
        console.log("  Parties       : 8 (5 customers + 3 vendors)");
        console.log("  Quotations    : 4");
        console.log("  Sales Orders  : 6 (INV-001 to INV-006)");
        console.log("  Purchase Orders: 4 (PO-001 to PO-004)");
        console.log(`  Ledger entries: ${ledgerEntries.length}`);
        console.log("====================================================");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

seed();
