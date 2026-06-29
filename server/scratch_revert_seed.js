import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { appConn } from './config/db.js';
import Finish from './models/Finish.js';
import Tenant from './models/Tenant.js';

dotenv.config();

const revertSeed = async () => {
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Find the specific tenant the user wants
        const targetTenant = await Tenant.findOne({ 
            $or: [
                { contactEmail: 'srialagartilesandgranites@gmail.com' },
                { slug: 'sri-alagar-tiles-and-granites' }
            ]
        });
        
        if (!targetTenant) {
            console.log("Target tenant not found");
            process.exit(1);
        }

        console.log("Keeping finishes for tenant: ", targetTenant.businessName);

        // Delete the default seeded finishes from ALL OTHER tenants
        const result = await Finish.deleteMany({
            description: 'Default imported finish',
            tenantId: { $ne: targetTenant._id }
        });
        
        console.log('Removed ' + result.deletedCount + ' finishes from other tenants.');
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
revertSeed();
