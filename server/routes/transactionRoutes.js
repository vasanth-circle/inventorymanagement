import express from 'express';
import {
    stockInward,
    stockOutward,
    stockTransfer,
    stockReturn,
    getTransactions,
    getItemHistory,
} from '../controllers/transactionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router.post('/inward', protect, checkMenuAccess('stock-inward'), validateRequest(schemas.createTransaction), stockInward);
router.post('/outward', protect, checkMenuAccess('stock-outward'), validateRequest(schemas.createTransaction), stockOutward);
router.post('/transfer', protect, checkMenuAccess('inventory'), validateRequest(schemas.createTransaction), stockTransfer);
router.post('/return', protect, checkMenuAccess('stock-return'), validateRequest(schemas.createTransaction), stockReturn);
router.get('/', protect, getTransactions);
router.get('/item/:itemId', protect, getItemHistory);

export default router;
