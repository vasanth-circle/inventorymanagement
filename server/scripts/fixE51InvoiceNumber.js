/**
 * Fix E-51: Assign a proper invoice number to the E-51 order which was
 * already converted (isEstimation: false) but retained the "E-" prefix.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI;

async function main() {
    console.log('\n🔧 Fix E-51 → Proper Invoice Number');
    console.log('=====================================\n');

    const conn = await mongoose.createConnection(MONGO_URI, { family: 4, dbName: 'inventorymanagement' }).asPromise();
    console.log(`✅ Connected | DB: ${conn.db.databaseName}`);

    const db = conn.db;
    const TENANT_ID = new mongoose.Types.ObjectId('69cbc53dd987cfa074267bba');

    // 1. Get next INV number by incrementing the counter
    const counter = await db.collection('counters').findOneAndUpdate(
        { id: 'INV', tenantId: TENANT_ID },
        { $inc: { seq: 1 } },
        { returnDocument: 'after' }
    );
    const newInvNumber = String(counter.seq);
    console.log(`\n📋 New Invoice Number: ${newInvNumber}`);

    // 2. Update E-51 order
    const orderResult = await db.collection('salesorders').updateOne(
        { orderNumber: 'E-51' },
        { $set: { orderNumber: newInvNumber, isEstimation: false, status: 'confirmed' } }
    );
    console.log(`✔ Order updated: ${orderResult.modifiedCount} doc(s)`);

    // 3. Update any CustomerLedger refs that still say E-51
    const ledgerResult = await db.collection('customerledgers').updateMany(
        { refNumber: 'E-51' },
        { $set: { refNumber: newInvNumber } }
    );
    console.log(`✔ Ledger refs updated: ${ledgerResult.modifiedCount} doc(s)`);

    // 4. Verify
    const verified = await db.collection('salesorders').findOne(
        { orderNumber: newInvNumber },
        { projection: { orderNumber: 1, isEstimation: 1, status: 1 } }
    );
    console.log(`\n🔍 Verified: #${verified?.orderNumber} | isEstimation: ${verified?.isEstimation} | status: ${verified?.status}`);

    console.log('\n=====================================');
    console.log(`✅ E-51 is now Invoice #${newInvNumber}`);
    console.log('   Hard-refresh the browser (Ctrl+Shift+R)');

    await conn.close();
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
