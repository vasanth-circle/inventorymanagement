import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { appConn, coreConn } from "./config/db.js";
import User from "./models/User.js";
import Category from "./models/Category.js";
import Finish from "./models/Finish.js";
import Size from "./models/Size.js";
import Brand from "./models/Brand.js";

const TARGET_EMAIL = "admin@inventory.com";

async function seedExtras() {
    try {
        await Promise.all([
            new Promise(r => appConn.readyState === 1 ? r() : appConn.once("open", r)),
            new Promise(r => coreConn.readyState === 1 ? r() : coreConn.once("open", r))
        ]);
        console.log("DB connected.");

        const user = await User.findOne({ email: TARGET_EMAIL });
        const tenantId = user?.tenantId;
        if (!tenantId) { console.error("No tenantId found"); process.exit(1); }
        console.log("Tenant ID:", tenantId);

        // Clear old extras
        await Promise.all([
            Finish.deleteMany({ tenantId }),
            Size.deleteMany({ tenantId }),
            Brand.deleteMany({ tenantId }),
        ]);
        console.log("Old Finishes, Sizes, Brands cleared.");

        // 1. FINISHES (tiles specific)
        console.log("Seeding Finishes...");
        await Finish.insertMany([
            { name: "Glossy",        description: "High shine glossy surface finish",          tenantId },
            { name: "Matte",         description: "Smooth non-reflective matte finish",        tenantId },
            { name: "Satin",         description: "Soft semi-gloss satin finish",              tenantId },
            { name: "Sugar",         description: "Grainy sugar finish for natural look",      tenantId },
            { name: "Rustic",        description: "Textured rustic / antique finish",          tenantId },
            { name: "Lappato",       description: "Semi-polished lappato surface",             tenantId },
            { name: "Polished",      description: "Mirror polished vitrified finish",          tenantId },
            { name: "Anti-Skid",     description: "Rough anti-skid surface for outdoor use",  tenantId },
        ]);
        console.log("8 finishes created.");

        // 2. SIZES (common tile dimensions)
        console.log("Seeding Sizes...");
        await Size.insertMany([
            { name: "300x300 mm",  width: 300,  height: 300,  unit: "mm", tenantId },
            { name: "300x450 mm",  width: 300,  height: 450,  unit: "mm", tenantId },
            { name: "300x600 mm",  width: 300,  height: 600,  unit: "mm", tenantId },
            { name: "400x400 mm",  width: 400,  height: 400,  unit: "mm", tenantId },
            { name: "600x600 mm",  width: 600,  height: 600,  unit: "mm", tenantId },
            { name: "800x800 mm",  width: 800,  height: 800,  unit: "mm", tenantId },
            { name: "600x1200 mm", width: 600,  height: 1200, unit: "mm", tenantId },
            { name: "800x1600 mm", width: 800,  height: 1600, unit: "mm", tenantId },
            { name: "12x18 inch",  width: 12,   height: 18,   unit: "inches", tenantId },
            { name: "24x24 inch",  width: 24,   height: 24,   unit: "inches", tenantId },
        ]);
        console.log("10 sizes created.");

        // 3. BRANDS — linked to categories
        console.log("Seeding Brands...");
        const cats = await Category.find({ tenantId });
        const catMap = {};
        cats.forEach(c => { catMap[c.name] = c._id; });

        const floorId    = catMap["Floor Tiles"];
        const wallId     = catMap["Wall Tiles"];
        const outdoorId  = catMap["Outdoor / Parking Tiles"];
        const sanitaryId = catMap["Sanitary Ware"];
        const accId      = catMap["Accessories"];

        const brandsData = [
            // Floor Tile Brands
            { name: "Kajaria",   description: "India largest tile brand",             categoryId: floorId,    tenantId },
            { name: "RAK",       description: "Premium UAE tile brand",               categoryId: floorId,    tenantId },
            { name: "Nitco",     description: "Premium Indian tile manufacturer",     categoryId: floorId,    tenantId },
            { name: "Orient",    description: "Orient Bell Ceramics",                 categoryId: floorId,    tenantId },
            { name: "Simpolo",   description: "Simpolo Ceramics & Vitrified",        categoryId: floorId,    tenantId },
            // Wall Tile Brands
            { name: "Somany",    description: "Somany Ceramics wall tile range",      categoryId: wallId,     tenantId },
            { name: "Johnson",   description: "Johnson Tiles India",                  categoryId: wallId,     tenantId },
            { name: "Nexion",    description: "Premium Italian wall tiles",           categoryId: wallId,     tenantId },
            // Outdoor / Parking Brands
            { name: "Kothari",   description: "Heavy duty parking tiles",             categoryId: outdoorId,  tenantId },
            { name: "Cera",      description: "Cera outdoor tile range",              categoryId: outdoorId,  tenantId },
            // Sanitary Ware Brands
            { name: "Hindware",  description: "Hindware sanitaryware",                categoryId: sanitaryId, tenantId },
            { name: "Parryware", description: "Parryware bath fittings",             categoryId: sanitaryId, tenantId },
            { name: "Jaquar",   description: "Jaquar bath & sanitary products",      categoryId: sanitaryId, tenantId },
            // Accessories Brands
            { name: "Weber",     description: "Weber tile adhesives and grouts",      categoryId: accId,      tenantId },
            { name: "Laticrete", description: "Laticrete tile installation products", categoryId: accId,      tenantId },
        ];

        await Brand.insertMany(brandsData);
        console.log(`${brandsData.length} brands created.`);

        console.log("====================================================");
        console.log("Extras seeded successfully!");
        console.log("  - 8 Finishes  (Glossy, Matte, Satin, Sugar, Rustic, Lappato, Polished, Anti-Skid)");
        console.log("  - 10 Sizes    (300x300 to 800x1600 mm + inches)");
        console.log("  - 15 Brands   (across Floor, Wall, Outdoor, Sanitary, Accessories)");
        console.log("====================================================");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
}

seedExtras();
