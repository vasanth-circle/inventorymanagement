import { appConn } from './config/db.js';
import CustomerType from './models/CustomerType.js';
import User from './models/User.js';

async function seedCustomerTypes() {
    try {
        await appConn.asPromise(); // Wait for DB connection
        console.log('Database connection ready.');
        
        // Grab the main tenant ID from an admin user
        const user = await User.findOne({ role: { $in: ['admin', 'tenant_owner'] } });
        if (!user) {
            console.error('No admin user found to grab tenant ID');
            process.exit(1);
        }
        
        const tenantId = user.tenantId;
        console.log(`Using Tenant ID: ${tenantId}`);

        const typesToSeed = [
            'Walk-in',
            'Digital Marketing',
            'Referral',
            'Codissia Association',
            'Others'
        ];

        for (const typeName of typesToSeed) {
            const existing = await CustomerType.findOne({ name: typeName, tenantId });
            if (!existing) {
                await CustomerType.create({ name: typeName, tenantId, description: `System seeded type: ${typeName}` });
                console.log(`Created: ${typeName}`);
            } else {
                console.log(`Already exists: ${typeName}`);
            }
        }
        
        console.log('Finished seeding customer types.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding:', err);
        process.exit(1);
    }
}

seedCustomerTypes();
