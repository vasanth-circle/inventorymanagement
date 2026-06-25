import express from 'express';
import { getVendorLedger, recordPayment, addAdjustment, getVendorOverallStatement, getVendorPayables, getVendorOutstandingSummary } from '../controllers/vendorLedgerController.js';

const router = express.Router();

router.get('/statements/overall', getVendorOverallStatement);
router.get('/reports/payables', getVendorPayables);
router.get('/reports/outstanding-summary', getVendorOutstandingSummary);
router.get('/:vendorId', getVendorLedger);
router.post('/payment', recordPayment);
router.post('/adjustment', addAdjustment);

export default router;
