import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function run() {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const collection = db.collection('items');
    
    // Find tiles that have sqFtPerPc > 0 and unitType = 'pcs' or 'pieces'
    const query = { 
        sqFtPerPc: { $gt: 0 },
        unitType: { $in: ['pcs', 'pieces', 'piece', 'nos'] }
    };
    
    const items = await collection.find(query).toArray();
    console.log(`Found ${items.length} tiles with incorrect unitType`);
    
    if (items.length > 0) {
        const res = await collection.updateMany(query, {
            $set: { 
                unitType: 'box',
                'customFields.unitType': 'box'
            }
        });
        console.log(`Updated ${res.modifiedCount} items to 'box'`);
    }
    
    await mongoose.disconnect();
}
run();
