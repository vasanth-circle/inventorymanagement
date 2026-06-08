import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || process.env.CORE_MONGODB_URI;
await mongoose.connect(uri);

const Item = mongoose.model('Item', new mongoose.Schema({
    name: String,
    location: String,
    tenantId: mongoose.Schema.Types.ObjectId,
}, { strict: false }));

const items = await Item.find({}).select('name location tenantId').limit(30).lean();
console.log('=== ITEMS WITH LOCATION FIELD ===');
const withLocation = items.filter(i => i.location);
const withoutLocation = items.filter(i => !i.location);
console.log(`Total: ${items.length}, With location: ${withLocation.length}, Without: ${withoutLocation.length}`);
withLocation.forEach(i => console.log(`  "${i.name}" => location: "${i.location}"`));
if (!withLocation.length) {
    console.log('  (No items have a location set)');
    console.log('\nSample items (no location):');
    items.slice(0, 5).forEach(i => console.log(`  "${i.name}"`));
}
mongoose.disconnect();
