import express from 'express';
import { getLogs } from '../controllers/logController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Allow admins to view logs
router.get('/', authorize('super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager'), getLogs);

export default router;
