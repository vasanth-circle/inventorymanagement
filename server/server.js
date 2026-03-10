import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();

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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Error handler (must be last)
app.use(errorHandler);

import { authConn, appConn, coreConn } from './config/db.js';
import { checkTenantStatus } from './middleware/tenantMiddleware.js';

// Apply tenant check middleware to all /api routes (except auth/login/register if needed)
// For now, applying to all /api to be safe
app.use('/api', checkTenantStatus);

// MongoDB connection status check
const startServer = async () => {
    try {
        // Wait for all three connections to be established
        await Promise.all([
            new Promise((resolve, reject) => {
                if (authConn.readyState === 1) resolve();
                authConn.once('open', resolve);
                authConn.once('error', reject);
            }),
            new Promise((resolve, reject) => {
                if (appConn.readyState === 1) resolve();
                appConn.once('open', resolve);
                appConn.once('error', reject);
            }),
            new Promise((resolve, reject) => {
                if (coreConn.readyState === 1) resolve();
                coreConn.once('open', resolve);
                coreConn.once('error', reject);
            })
        ]);

        console.log('All MongoDB connections (Auth, App, Core) established successfully');

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.error('Failed to establish database connections:', error);
        process.exit(1);
    }
};

startServer();

export default app;
