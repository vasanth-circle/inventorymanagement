import express from 'express';
import {
    createBinLocation, getBinLocations,
    createBOM, getBOMs,
    createProductionOrder, getProductionOrders, completeProductionOrder,
    getAiInsights, getBiDashboardData
} from '../controllers/phase3Controller.js';
import { protect as requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

// Bin Management
router.post('/bins', createBinLocation);
router.get('/bins', getBinLocations);

// Manufacturing
router.post('/boms', createBOM);
router.get('/boms', getBOMs);
router.post('/production-orders', createProductionOrder);
router.get('/production-orders', getProductionOrders);
router.post('/production-orders/:id/complete', completeProductionOrder);

// AI & BI
router.get('/insights', getAiInsights);
router.get('/dashboard', getBiDashboardData);

export default router;
