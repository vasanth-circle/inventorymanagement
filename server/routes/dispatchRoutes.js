import express from 'express';
import { createDispatch, getDispatches, getOrderDispatches } from '../controllers/dispatchController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, authorize('admin', 'tenant_owner', 'tenant_admin', 'manager', 'staff'), createDispatch);
router.get('/', protect, getDispatches);
router.get('/order/:orderId', protect, getOrderDispatches);

export default router;
