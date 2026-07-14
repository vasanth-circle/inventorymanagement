import express from 'express';
import { createDispatch, getDispatches, getOrderDispatches, fulfillDispatch, updateDispatch, deleteDispatch } from '../controllers/dispatchController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router.use(checkMenuAccess('dispatch-management'));

router.post('/', protect, authorize('admin', 'tenant_owner', 'tenant_admin', 'manager', 'staff', 'sales_person', 'sales person', 'sales user', 'sales_user'), createDispatch);
router.put('/:id/fulfill', protect, authorize('admin', 'tenant_owner', 'tenant_admin', 'manager', 'godown_staff', 'godown staff', 'staff'), fulfillDispatch);
router.get('/', protect, getDispatches);
router.get('/order/:orderId', protect, getOrderDispatches);
router.put('/:id', protect, authorize('admin', 'tenant_owner', 'tenant_admin', 'manager', 'staff', 'sales_person', 'sales person', 'sales user', 'sales_user'), updateDispatch);
router.delete('/:id', protect, authorize('admin', 'tenant_owner', 'tenant_admin', 'manager', 'staff', 'sales_person', 'sales person', 'sales user', 'sales_user'), deleteDispatch);

export default router;
