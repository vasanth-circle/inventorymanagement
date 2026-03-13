import dotenv from 'dotenv';
// Initialize dotenv at the very top before any local imports that depend on process.env
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import excelRoutes from './routes/excelRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import salesOrderRoutes from './routes/salesOrderRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import locationRoutes from './routes/locationRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', limiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/locations', locationRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Error handler (must be last)
app.use(errorHandler);

import { appConn, coreConn } from './config/db.js';
import { checkTenantStatus } from './middleware/tenantMiddleware.js';

// Apply tenant check middleware to all /api routes (except health and auth)
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth') || req.path === '/health') {
        return next();
    }
    checkTenantStatus(req, res, next);
});

// MongoDB connection status check
const startServer = async () => {
    const PORT = process.env.PORT || 5000;

    // Start listening immediately to avoid 502 Bad Gateway
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log('Waiting for database connections...');
    });

    try {
        // Log connection attempts
        if (!process.env.APP_MONGODB_URI) console.warn('Warning: APP_MONGODB_URI is not defined');
        if (!process.env.CORE_MONGODB_URI) console.warn('Warning: CORE_MONGODB_URI is not defined');

        // Monitor connections
        await Promise.all([
            new Promise((resolve, reject) => {
                if (appConn.readyState === 1) resolve();
                appConn.once('open', () => {
                    console.log('MongoDB connected to App database');
                    resolve();
                });
                appConn.once('error', (err) => {
                    console.error('MongoDB connection error for App:', err.message);
                    resolve();
                });
            }),
            new Promise((resolve, reject) => {
                if (coreConn.readyState === 1) resolve();
                coreConn.once('open', () => {
                    console.log('MongoDB connected to Core database');
                    resolve();
                });
                coreConn.once('error', (err) => {
                    console.error('MongoDB connection error for Core:', err.message);
                    resolve();
                });
            })
        ]);

        console.log('Initial database connection checks completed.');
    } catch (error) {
        console.error('Unexpected error during startup:', error);
    }
};

startServer();

export default app;
