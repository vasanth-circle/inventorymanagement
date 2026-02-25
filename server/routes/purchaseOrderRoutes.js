import express from 'express';
import {
    getPurchaseOrders,
    getPurchaseOrder,
    createPurchaseOrder,
    updatePOStatus,
} from '../controllers/purchaseOrderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(checkMenuAccess('purchases'));

router.route('/')
    .get(getPurchaseOrders)
    .post(createPurchaseOrder);

router.route('/:id')
    .get(getPurchaseOrder);

router.route('/:id/status')
    .patch(updatePOStatus);

export default router;
