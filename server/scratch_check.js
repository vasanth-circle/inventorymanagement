import db from './config/db.js';
import Item from './models/Item.js';

async function checkItem() {
    try {
        await db.baseConn.asPromise();
        const item = await Item.findOne({ name: /OXFORD BROWN/i });
        console.log('Item:', item ? { name: item.name, sqFtPerPc: item.sqFtPerPc, pcsPerBox: item.pcsPerBox, sqFtPerBox: item.sqFtPerBox, category: item.category } : 'Not found');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkItem();
