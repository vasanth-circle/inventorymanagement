import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import { appConn } from './config/db.js';

async function getSettings() {
    try {
        console.log('Connecting to DB...');
        while (appConn.readyState !== 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Find tenant and then settings
        const tenants = await appConn.collection('tenants').find({}).toArray();
        console.log('Tenants:', tenants);
        const settings = await appConn.collection('settings').find({}).toArray();
        console.log('Settings:', JSON.stringify(settings, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
getSettings();
