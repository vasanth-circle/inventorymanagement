import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.APP_MONGODB_URI;

async function main() {
    const conn = await mongoose.createConnection(MONGO_URI, { family: 4 }).asPromise();
    const Customer = conn.model('Customer', new mongoose.Schema({}, { strict: false }));
    const CustomerLedger = conn.model('CustomerLedger', new mongoose.Schema({}, { strict: false }));

    const customer = await Customer.findOne({ $or: [{ name: /ANJU MIRIUM/i }, { companyName: /ANJU MIRIUM/i }] });
    if (!customer) {
        console.log('not found');
        process.exit(0);
    }

    console.log(`Found Customer: ${customer.name || customer.companyName}, Opening Balance: ${customer.openingBalance}`);
    const entries = await CustomerLedger.find({ customer: customer._id }).sort({ date: 1, createdAt: 1 });

    for (const e of entries) {
        console.log({
            date: e.date,
            type: e.type,
            desc: e.description,
            dr: e.debit,
            cr: e.credit,
            bal: e.balance
        });
    }

    await conn.close();
    process.exit(0);
}

main();