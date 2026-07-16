/**
 * One-time fix: rename all size names with * separator to X
 * e.g. 2400*800 -> 2400X800,  3*2 -> 3X2
 * Run: node scripts/fix_size_names.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) { console.error("MONGO_URI not found"); process.exit(1); }

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("sizes");

    const sizesWithAsterisk = await collection.find({ name: /\*/ }).toArray();

    if (sizesWithAsterisk.length === 0) {
        console.log("No sizes with * found. Nothing to update.");
        await mongoose.disconnect();
        return;
    }

    console.log(`Found ${sizesWithAsterisk.length} sizes to rename:\n`);
    let updated = 0, skipped = 0;

    for (const size of sizesWithAsterisk) {
        const oldName = size.name;
        const newName = oldName.replace(/\*/g, "X");
        const existing = await collection.findOne({ name: newName, tenantId: size.tenantId });
        if (existing) {
            console.log(`  SKIP  "${oldName}" -> "${newName}" (already exists)`);
            skipped++;
            continue;
        }
        await collection.updateOne({ _id: size._id }, { $set: { name: newName } });
        console.log(`  RENAMED  "${oldName}"  ->  "${newName}"`);
        updated++;
    }

    console.log(`\nUpdated: ${updated}, Skipped: ${skipped}`);
    await mongoose.disconnect();
    console.log("Done.");
}

run().catch(err => { console.error("Error:", err); process.exit(1); });
