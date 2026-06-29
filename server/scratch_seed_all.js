import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { appConn } from './config/db.js';
import Finish from './models/Finish.js';
import Tenant from './models/Tenant.js';

dotenv.config();

const seedAll = async () => {
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const tenants = await Tenant.find({}, '_id');
        const finishes = ['Glossy', 'Matte', 'Satin', 'Sugar', 'Rustic'];
        
        for (const tenant of tenants) {
            for (const name of finishes) {
                await Finish.updateOne(
                    { name, tenantId: tenant._id },
                    { $set: { name, tenantId: tenant._id, description: 'Default imported finish' } },
                    { upsert: true }
                );
            }
        }
        console.log('Seeded finishes for all ' + tenants.length + ' tenants!');
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
seedAll();
