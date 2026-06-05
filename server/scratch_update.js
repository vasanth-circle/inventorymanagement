import db from './config/db.js';
import Item from './models/Item.js';
import Category from './models/Category.js';

async function updateItems() {
    try {
        await db.baseConn.asPromise(); // Wait for connection to be ready
        console.log('Database connection ready.');
        
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        
        let tilesCategory = await Category.findOne({ name: { $regex: /^Tiles$/i } });
        if (!tilesCategory) {
            console.log('Tiles category not found, creating it...');
            tilesCategory = await Category.create({ name: 'Tiles' });
        }
        
        const result = await Item.updateMany(
            { updatedAt: { $gte: threeHoursAgo } },
            { $set: { category: tilesCategory._id } }
        );
        
        console.log(`Successfully updated ${result.modifiedCount} items out of ${result.matchedCount} matched items to category 'Tiles' (${tilesCategory._id})`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

updateItems();
