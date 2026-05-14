import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const uri = process.env.MONGODB_URI;
    console.log('Connecting to:', uri);
    const conn = await mongoose.createConnection(uri).asPromise();
    const items = await conn.collection('items').find({ tenantId: { $not: { $type: 'objectId' } } }).limit(5).toArray();
    console.log('Items with non-ObjectId tenantId:', JSON.stringify(items, null, 2));
    
    const sample = await conn.collection('items').findOne({});
    console.log('Sample item tenantId type:', typeof sample?.tenantId, sample?.tenantId?.constructor?.name);
    
    process.exit(0);
};

run().catch(err => {
    console.error(err);
    process.exit(1);
});
