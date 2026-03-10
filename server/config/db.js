import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const createConnection = (uri, dbName) => {
    if (!uri) {
        console.error(`CRITICAL: ${dbName} database URI is not defined!`);
        // Return a connection that will fail early if used
        const conn = mongoose.createConnection();
        return conn;
    }

    const conn = mongoose.createConnection(uri);

    conn.on('connected', () => {
        console.log(`MongoDB connected to ${dbName} database`);
    });

    conn.on('error', (err) => {
        console.error(`MongoDB connection error for ${dbName}:`, err);
    });

    return conn;
};

export const appConn = createConnection(process.env.APP_MONGODB_URI || process.env.MONGODB_URI, 'App');
export const coreConn = createConnection(process.env.CORE_MONGODB_URI, 'Core');

export default {
    appConn,
    coreConn
};
