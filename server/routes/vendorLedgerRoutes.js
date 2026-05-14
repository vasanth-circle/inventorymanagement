import express from 'express';
import { getVendorLedger, recordPayment, addAdjustment, getVendorOverallStatement } from '../controllers/vendorLedgerController.js';

const router = express.Router();

router.get('/statements/overall', getVendorOverallStatement);
router.get('/:vendorId', getVendorLedger);
router.post('/payment', recordPayment);
router.post('/adjustment', addAdjustment);

export default router;
