import express from 'express';
import { 
    getVendorLedger, 
    recordPayment, 
    updatePayment,
    deletePayment,
    addAdjustment, 
    getVendorOverallStatement, 
    getVendorPayables, 
    getVendorOutstandingSummary,
    getCombinedLedger,
} from '../controllers/vendorLedgerController.js';

const router = express.Router();

router.get('/statements/overall', getVendorOverallStatement);
router.get('/reports/payables', getVendorPayables);
router.get('/reports/outstanding-summary', getVendorOutstandingSummary);
router.get('/:vendorId/combined', getCombinedLedger);
router.get('/:vendorId', getVendorLedger);
router.post('/payment', recordPayment);
router.put('/payment/:entryId', updatePayment);
router.delete('/payment/:entryId', deletePayment);
router.post('/adjustment', addAdjustment);

export default router;
