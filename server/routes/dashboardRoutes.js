import express from 'express';
import {
    getDashboardStats,
    getLowStockItems,
    getRecentTransactions,
    getStockTrend,
} from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/stats', protect, getDashboardStats);
router.get('/low-stock', protect, getLowStockItems);
router.get('/recent-transactions', protect, getRecentTransactions);
router.get('/stock-trend', protect, getStockTrend);

export default router;
