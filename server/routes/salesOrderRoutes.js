import express from 'express';
import {
    getSalesOrders,
    getSalesOrder,
    createSalesOrder,
    updateSOStatus,
    updateSalesOrder,
    deleteSalesOrder,
} from '../controllers/salesOrderController.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';
import { authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// router.use(protect); // Global middleware handles this now
router.use(checkMenuAccess('sales-orders'));

router.route('/')
    .get(getSalesOrders)
    .post(createSalesOrder);

router.route('/:id')
    .get(getSalesOrder)
    .put(updateSalesOrder)
    .delete(authorize('admin', 'super_admin', 'tenant_owner', 'tenant_admin'), deleteSalesOrder);

router.route('/:id/status')
    .patch(updateSOStatus);

export default router;
