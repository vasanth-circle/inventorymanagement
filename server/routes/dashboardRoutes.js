import express from 'express';
import {
    getDashboardStats,
    getLowStockItems,
    getRecentTransactions,
    getStockTrend,
} from '../controllers/dashboardController.js';
// import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/stats', getDashboardStats);
router.get('/low-stock', getLowStockItems);
router.get('/recent-transactions', getRecentTransactions);
router.get('/stock-trend', getStockTrend);

export default router;
