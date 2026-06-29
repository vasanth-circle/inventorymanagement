import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { appConn } from './config/db.js';
import Finish from './models/Finish.js';
import Tenant from './models/Tenant.js';

dotenv.config();

const checkDb = async () => {
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const finishes = await Finish.find().lean();
        console.log(JSON.stringify(finishes, null, 2));
        
        const tenants = await Tenant.find({}, '_id businessName slug').lean();
        console.log('Tenants:', JSON.stringify(tenants, null, 2));
        
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
checkDb();
