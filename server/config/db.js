import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const createConnection = (uri, dbName) => {
    const conn = mongoose.createConnection(uri);

    conn.on('connected', () => {
        console.log(`MongoDB connected to ${dbName} database`);
    });

    conn.on('error', (err) => {
        console.error(`MongoDB connection error for ${dbName}:`, err);
    });

    return conn;
};

export const authConn = createConnection(process.env.AUTH_MONGODB_URI, 'Auth');
export const appConn = createConnection(process.env.APP_MONGODB_URI, 'App');
export const coreConn = createConnection(process.env.CORE_MONGODB_URI, 'Core');

export default {
    authConn,
    appConn,
    coreConn
};
