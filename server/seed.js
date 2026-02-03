import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './models/Category.js';
import User from './models/User.js';

dotenv.config();

const categories = [
    { name: 'Electronics', description: 'Electronic devices and accessories' },
    { name: 'Furniture', description: 'Office and home furniture' },
    { name: 'Stationery', description: 'Office supplies and stationery items' },
    { name: 'Hardware', description: 'Tools and hardware equipment' },
    { name: 'Consumables', description: 'Consumable items and supplies' },
];

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');

        // Clear existing data
        await Category.deleteMany({});
        console.log('Cleared existing categories');

        // Insert categories
        const createdCategories = await Category.insertMany(categories);
        console.log(`Created ${createdCategories.length} categories`);

        // Create default admin user if not exists
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

        console.log('Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
