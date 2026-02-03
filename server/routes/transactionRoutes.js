import express from 'express';
import {
    stockInward,
    stockOutward,
    stockTransfer,
    getTransactions,
    getItemHistory,
} from '../controllers/transactionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router.post('/inward', protect, validateRequest(schemas.createTransaction), stockInward);
router.post('/outward', protect, validateRequest(schemas.createTransaction), stockOutward);
router.post('/transfer', protect, validateRequest(schemas.createTransaction), stockTransfer);
router.get('/', protect, getTransactions);
router.get('/item/:itemId', protect, getItemHistory);

export default router;
