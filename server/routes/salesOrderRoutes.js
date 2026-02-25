import express from 'express';
import {
    getSalesOrders,
    getSalesOrder,
    createSalesOrder,
    updateSOStatus,
} from '../controllers/salesOrderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(checkMenuAccess('sales'));

router.route('/')
    .get(getSalesOrders)
    .post(createSalesOrder);

router.route('/:id')
    .get(getSalesOrder);

router.route('/:id/status')
    .patch(updateSOStatus);

export default router;
