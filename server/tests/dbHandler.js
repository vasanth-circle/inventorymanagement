import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let appMemoryServer;
let coreMemoryServer;

export const connect = async () => {
    appMemoryServer = await MongoMemoryServer.create();
    coreMemoryServer = await MongoMemoryServer.create();

    const appUri = appMemoryServer.getUri();
    const coreUri = coreMemoryServer.getUri();

    process.env.APP_MONGODB_URI = appUri;
    process.env.CORE_MONGODB_URI = coreUri;
    process.env.JWT_SECRET = 'test_secret';
};

export const closeDatabase = async () => {
    await mongoose.disconnect();
    if (appMemoryServer) await appMemoryServer.stop();
    if (coreMemoryServer) await coreMemoryServer.stop();
};

export const clearDatabase = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
};
