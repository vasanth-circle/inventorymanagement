import express from 'express';
import { createDispatch, getDispatches, getOrderDispatches, fulfillDispatch } from '../controllers/dispatchController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router.use(checkMenuAccess('dispatch-management'));

router.post('/', protect, authorize('admin', 'tenant_owner', 'tenant_admin', 'manager', 'staff', 'sales_person', 'sales person', 'sales user', 'sales_user'), createDispatch);
router.put('/:id/fulfill', protect, authorize('admin', 'tenant_owner', 'tenant_admin', 'manager', 'godown_staff', 'godown staff', 'staff'), fulfillDispatch);
router.get('/', protect, getDispatches);
router.get('/order/:orderId', protect, getOrderDispatches);

export default router;
