import mongoose from 'mongoose';
import { appConn, coreConn } from './config/db.js';
import Tenant from './models/Tenant.js';
import Customer from './models/Customer.js';

async function run() {
    try {
        console.log('Connecting...');
        // Wait for connection to be ready if needed, Mongoose handles queueing queries
        
        // Find tenant by name matching 'alagar'
        const tenant = await Tenant.findOne({ businessName: { $regex: /alagar/i } });
        if (!tenant) {
            console.log('Tenant not found');
            process.exit(1);
        }
        
        console.log(`Found tenant: ${tenant.businessName} (ID: ${tenant._id})`);
        
        // Find customers
        const customers = await Customer.find({ tenantId: tenant._id }).sort({ name: 1 });
        
        console.log(`Found ${customers.length} customers.`);
        
        let output = 'Name,Phone,Phone 2,Email,Address\n';
        
        for (const c of customers) {
            const address = c.address?.billing?.city || '';
            // Escape commas and quotes for CSV
            const escapeCSV = (str) => {
                if (!str) return '';
                const s = String(str).replace(/"/g, '""');
                return /[",\n]/.test(s) ? `"${s}"` : s;
            };
            output += `${escapeCSV(c.name)},${escapeCSV(c.phone)},${escapeCSV(c.phone2)},${escapeCSV(c.email)},${escapeCSV(address)}\n`;
        }
        
        import('fs').then(fs => {
            fs.writeFileSync('alagar_customers_list.csv', output);
            console.log('Saved to alagar_customers_list.csv');
            process.exit(0);
        });
        
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
