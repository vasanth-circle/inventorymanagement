import express from 'express';
import {
    stockInward,
    stockOutward,
    stockTransfer,
    stockReturn,
    stockAdjustment,
    getTransactions,
    getItemHistory,
    upload
} from '../controllers/transactionController.js';
// import { protect } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router.post('/inward', checkMenuAccess('stock-inward'), upload.single('invoiceImage'), validateRequest(schemas.createTransaction), stockInward);
router.post('/outward', checkMenuAccess('stock-outward'), validateRequest(schemas.createTransaction), stockOutward);
router.post('/transfer', checkMenuAccess('inventory'), validateRequest(schemas.createTransaction), stockTransfer);
router.post('/return', checkMenuAccess('stock-return'), validateRequest(schemas.createTransaction), stockReturn);
router.post('/adjustment', checkMenuAccess('stocks'), validateRequest(schemas.createTransaction), stockAdjustment);
router.get('/', getTransactions);
router.get('/item/:itemId', getItemHistory);

export default router;
