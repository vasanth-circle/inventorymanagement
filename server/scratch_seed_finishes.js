import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { appConn } from './config/db.js';
import Finish from './models/Finish.js';
import Tenant from './models/Tenant.js';

dotenv.config();

const seed = async () => {
    try {
        console.log('Waiting for db connection...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const tenant = await Tenant.findOne();
        if (!tenant) throw new Error('No tenant found');

        const finishes = ['Glossy', 'Matte', 'Satin', 'Sugar', 'Rustic'];
        for (const name of finishes) {
            await Finish.updateOne(
                { name, tenantId: tenant._id },
                { $set: { name, tenantId: tenant._id, description: 'Default imported finish' } },
                { upsert: true }
            );
            console.log('Upserted: ' + name);
        }
        console.log('Seeded successfully');
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
seed();
