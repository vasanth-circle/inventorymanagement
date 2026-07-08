import express from 'express';
import { 
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrder,
    updatePOStatus,
    receivePurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder
} from '../controllers/purchaseOrderController.js';
import { processOcrBill } from '../controllers/phase2Controller.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// router.use(protect); // Global middleware handles this now
router.use(checkMenuAccess('purchases'));

router.route('/')
    .get(getPurchaseOrders)
    .post(createPurchaseOrder);

router.post('/ocr-scan', upload.single('billImage'), processOcrBill);

router.route('/:id')
    .get(getPurchaseOrder)
    .put(updatePurchaseOrder)
    .delete(deletePurchaseOrder);

router.route('/:id/status')
    .patch(updatePOStatus);

router.route('/:id/receive')
    .post(receivePurchaseOrder);

export default router;
