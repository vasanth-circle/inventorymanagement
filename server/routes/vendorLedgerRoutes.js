import express from 'express';
import { getVendorLedger, recordPayment, addAdjustment } from '../controllers/vendorLedgerController.js';

const router = express.Router();

router.get('/:vendorId', getVendorLedger);
router.post('/payment', recordPayment);
router.post('/adjustment', addAdjustment);

export default router;
