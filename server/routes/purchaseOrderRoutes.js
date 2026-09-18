import express from 'express';
import {
    getPurchaseOrders,
    getPurchaseOrder,
    createPurchaseOrder,
    updatePOStatus,
    receivePurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    approvePurchaseOrder
} from '../controllers/purchaseOrderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

// router.use(protect); // Global middleware handles this now
router.use(checkMenuAccess('purchases'));

router.route('/')
    .get(getPurchaseOrders)
    .post(createPurchaseOrder);

// Requires admin or manager access for approvals
router.patch('/:id/approve', authorize('super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager'), approvePurchaseOrder);

router.route('/:id')
    .get(getPurchaseOrder)
    .put(updatePurchaseOrder)
    .delete(deletePurchaseOrder);

router.route('/:id/status')
    .patch(updatePOStatus);

router.route('/:id/receive')
    .post(receivePurchaseOrder);

export default router;
