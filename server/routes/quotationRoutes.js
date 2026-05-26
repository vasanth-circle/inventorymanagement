import express from 'express';
import {
    getQuotations,
    getQuotation,
    createQuotation,
    updateQuotation,
    convertToInvoice,
    deleteQuotation,
} from '../controllers/quotationController.js';

import { checkMenuAccess } from '../middleware/accessMiddleware.js';
import { authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(checkMenuAccess('quotations'));

router.get('/', getQuotations);
router.get('/:id', getQuotation);
router.post('/', createQuotation);
router.put('/:id', updateQuotation);
router.post('/:id/convert', convertToInvoice);
router.delete('/:id', authorize('admin', 'super_admin', 'tenant_owner', 'tenant_admin'), deleteQuotation);

export default router;
