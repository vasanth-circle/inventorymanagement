import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;

async function main() {
    const conn = await mongoose.createConnection(MONGO_URI, { family: 4 }).asPromise();
    const CustomerLedger = conn.model('CustomerLedger', new mongoose.Schema({}, { strict: false }));

    const wrongEntries = await CustomerLedger.find({
        type: 'adjustment',
        description: { $regex: /Refund/i },
        credit: { $gt: 0 }
    });

    for (const entry of wrongEntries) {
        console.log('Fixing entry:', entry._id, 'Credit:', entry.credit);
        await CustomerLedger.updateOne(
            { _id: entry._id },
            { $set: { debit: entry.credit, credit: 0 } }
        );
    }

    await conn.close();
    process.exit(0);
}
main();