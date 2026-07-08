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
import dispatchRoutes from './routes/dispatchRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import quotationRoutes from './routes/quotationRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import productShowcaseRoutes from './routes/productShowcaseRoutes.js';
import publicProductRoutes from './routes/publicProductRoutes.js';
import vendorLedgerRoutes from './routes/vendorLedgerRoutes.js';
import hsnRoutes from './routes/hsnRoutes.js';
import sizeRoutes from './routes/sizeRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import finishRoutes from './routes/finishRoutes.js';
import profitTrackingRoutes from './routes/profitRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import actionLogRoutes from './routes/logRoutes.js';
import creditNoteRoutes from './routes/creditNoteRoutes.js';
import grnRoutes from './routes/grnRoutes.js';
import warehouseTransferRoutes from './routes/warehouseTransferRoutes.js';

// Phase 2 Routes
import workflowRoutes from './routes/workflowRoutes.js';
import publicApiRoutes from './routes/publicApiRoutes.js';
import ecommerceRoutes from './routes/ecommerceRoutes.js';

// Phase 3 Routes
import phase3Routes from './routes/phase3Routes.js';

// Background services
import { initScheduledJobs } from './services/scheduledJobs.js';

import fixLegacyIndexes from './utils/fixIndexes.js';
// Ensure User model is registered on appConn for cross-connection populate
import { AppUser } from './models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable trust proxy for CapRover (behind Nginx)
app.set('trust proxy', 1);

// Rate limiting disabled temporarily due to proxy IP issues
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100000, // effectively disabled
    message: 'Too many requests from this IP, please try again later.',
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', limiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

import { appConn, coreConn } from './config/db.js';
import { checkTenantStatus } from './middleware/tenantMiddleware.js';

import { protect } from './middleware/authMiddleware.js';

// Apply tenant check middleware to all /api routes (except health and auth)
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth') || req.path === '/health' || req.path.startsWith('/public')) {
        return next();
    }
    // Run protect first to get req.user, then checkTenantStatus to get req.tenantId
    protect(req, res, (err) => {
        if (err) return next(err);
        checkTenantStatus(req, res, next);
    });
});

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
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/product-showcase', productShowcaseRoutes);
app.use('/api/public', publicProductRoutes);
app.use('/api/vendor-ledger', vendorLedgerRoutes);
app.use('/api/hsn', hsnRoutes);
app.use('/api/sizes', sizeRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/finishes', finishRoutes);
app.use('/api/logs', actionLogRoutes);
app.use('/api/profit', profitTrackingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/credit-notes', creditNoteRoutes);
app.use('/api/grn', grnRoutes);
app.use('/api/warehouse-transfers', warehouseTransferRoutes);

// Phase 2 Endpoints
app.use('/api/v1', publicApiRoutes); // Public API has its own auth middleware inside
app.use('/api/workflows', workflowRoutes);
app.use('/api/ecommerce', ecommerceRoutes);

// Phase 3 Endpoints
app.use('/api/phase3', phase3Routes);

// Initialize scheduled background jobs
initScheduledJobs();

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Error handler (must be last)
app.use(errorHandler);


// MongoDB connection status check
const startServer = async () => {
    const PORT = process.env.PORT || 5000;

    // Start listening immediately to avoid 502 Bad Gateway
    const server = app.listen(PORT, '0.0.0.0', async () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log('Waiting for database connections...');
        
        // Wait for connection then fix indexes
        appConn.on('connected', async () => {
            await fixLegacyIndexes();
        });
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

if (process.env.NODE_ENV !== 'test') {
    startServer();
}

export default app;
// Server restart triggered by role update

// trigger restart
