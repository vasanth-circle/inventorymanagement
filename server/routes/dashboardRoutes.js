import express from 'express';
import {
    getDashboardStats,
    getLowStockItems,
    getRecentTransactions,
    getStockTrend,
    getInventoryDashboard,
} from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/stats', getDashboardStats);
router.get('/low-stock', getLowStockItems);
router.get('/recent-transactions', getRecentTransactions);
router.get('/stock-trend', getStockTrend);
router.get('/inventory', getInventoryDashboard);

export default router;
