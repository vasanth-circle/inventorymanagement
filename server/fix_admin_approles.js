import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { coreConn } from './config/db.js';
import User from './models/User.js';

async function fix() {
    await new Promise(resolve => coreConn.readyState === 1 ? resolve() : coreConn.once('open', resolve));
    const result = await User.findOneAndUpdate(
        { email: 'admin@inventory.com' },
        { appRoles: { inventory: 'admin', crm: null, proposal: null, hr: null, task: null, billing: null, whatsapp: null } },
        { new: true }
    );
    console.log('Updated user:', result.email, '| appRoles.inventory:', result.appRoles?.inventory);
    process.exit(0);
}
fix().catch(e => { console.error(e); process.exit(1); });
