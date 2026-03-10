import dotenv from 'dotenv';
import { appConn, coreConn } from './config/db.js';
import Category from './models/Category.js';
import User from './models/User.js';
import Tenant from './models/Tenant.js';

dotenv.config();

const categories = [
    { name: 'Electronics', description: 'Electronic devices and accessories' },
    { name: 'Furniture', description: 'Office and home furniture' },
    { name: 'Stationery', description: 'Office supplies and stationery items' },
    { name: 'Hardware', description: 'Tools and hardware equipment' },
    { name: 'Consumables', description: 'Consumable items and supplies' },
];

const waitForConnection = (conn, name) => {
    return new Promise((resolve, reject) => {
        if (conn.readyState === 1) resolve();
        conn.once('open', () => {
            console.log(`Connected to ${name} database`);
            resolve();
        });
        conn.once('error', (err) => {
            console.error(`Connection error for ${name}:`, err);
            reject(err);
        });
    });
};

const seedDatabase = async () => {
    try {
        console.log('Connecting to databases...');
        await Promise.all([
            waitForConnection(appConn, 'App'),
            waitForConnection(coreConn, 'Core')
        ]);

        // 1. Seed Core DB (Default Tenant and User)
        console.log('Seeding Core DB...');
        const tenantExists = await Tenant.findOne({ slug: 'main-tenant' });
        if (!tenantExists) {
            await Tenant.create({
                businessName: 'Main Business',
                slug: 'main-tenant',
                status: 'Active',
                apps: [{ name: 'inventory', enabled: true }]
            });
            console.log('Created default tenant: Main Business');
        }

        // 2. Seed Users in Core DB (Default Admin)
        console.log('Seeding Users in Core DB...');
        const adminExists = await User.findOne({ email: 'admin@inventory.com' });
        if (!adminExists) {
            await User.create({
                name: 'Admin User',
                email: 'admin@inventory.com',
                password: 'admin123',
                role: 'admin',
            });
            console.log('Created default admin user (email: admin@inventory.com, password: admin123)');
        }

        // 3. Seed App DB (Categories)
        console.log('Seeding App DB...');
        const categoryCount = await Category.countDocuments();
        if (categoryCount === 0) {
            const createdCategories = await Category.insertMany(categories);
            console.log(`Created ${createdCategories.length} categories`);
        } else {
            console.log('Categories already exist, skipping...');
        }

        console.log('Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
