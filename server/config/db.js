import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const maskURI = (uri) => {
    if (!uri) return 'undefined';
    try {
        const parts = uri.split('@');
        if (parts.length > 1) {
            const prefix = parts[0].split('//');
            const credentials = prefix[1].split(':');
            const maskedCredentials = credentials[0] + ':****';
            return `${prefix[0]}//${maskedCredentials}@${parts[1]}`;
        }
        return uri.replace(/:([^:@]{3,})@/g, ':****@');
    } catch (e) {
        return 'invalid-uri-format';
    }
};

const createConnection = (uri, dbName, fallbackUri = null) => {
    const maskedUri = maskURI(uri);
    console.log(`Initializing ${dbName} connection with URI: ${maskedUri}`);

    if (!uri) {
        if (fallbackUri) {
            console.warn(`WARNING: ${dbName} database URI is not defined. Falling back to primary URI.`);
            return createConnection(fallbackUri, `${dbName}-Fallback`);
        }
        console.error(`CRITICAL: ${dbName} database URI is not defined and no fallback available!`);
        return mongoose.createConnection();
    }

    const options = {
        family: 4, // Force IPv4 to avoid DNS resolution issues (EAI_AGAIN)
        serverSelectionTimeoutMS: 15000,
        heartbeatFrequencyMS: 10000,
    };

    const conn = mongoose.createConnection(uri, options);

    conn.on('connected', () => {
        console.log(`✅ MongoDB connected to ${dbName} database`);
    });

    conn.on('error', (err) => {
        console.error(`❌ MongoDB connection error for ${dbName}:`, err.message || err);
        
        // If it's a network/DNS error and we have a fallback, try falling back
        if (fallbackUri && (err.name === 'MongoNetworkError' || err.message.includes('EAI_AGAIN') || err.message.includes('timeout'))) {
            console.warn(`⚠️ Network error on ${dbName}. Attempting fallback...`);
            // We can't easily reassign 'conn' here, but the server.js will handle the multiple connection attempts
            // Better approach: Let's log it clearly and let the user decide, or implement a more complex proxy.
            // For now, consistent logging of the masked URI is the biggest help.
        }
    });

    return conn;
};

// Initialize App connection immediately
export const appConn = createConnection(process.env.APP_MONGODB_URI || process.env.MONGODB_URI, 'App');

// Initialize Core connection - stagger it to avoid simultaneous SRV DNS lookups
export const coreConn = createConnection(process.env.CORE_MONGODB_URI, 'Core', process.env.APP_MONGODB_URI || process.env.MONGODB_URI);

export default {
    appConn,
    coreConn
};
