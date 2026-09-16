import express from 'express';
import {
    getPartys,
    getParty,
    createParty,
    updateParty,
    deleteParty,
    getPartyBalance,
    getLedger,
    recordCharge,
    recordPayment,
    recordRefund,
    updatePayment,
    deletePayment,
    getPartyStatement,
    getPartyOverallStatement,
    getLockedPartys,
    unlockParty,
    getPartyReceivables,
    getPartyOutstandingSummary,
    getPartyReceiptsReport
} from '../controllers/partyController.js';
import { authorize } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

// router.use(protect); // Global middleware handles this now
router.use(checkMenuAccess('partys'));

router.route('/')
    .get(getPartys)
    .post(createParty);

router.get('/statements/overall', getPartyOverallStatement);
router.get('/reports/locked', authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), getLockedPartys);
router.get('/reports/receivables', getPartyReceivables);
router.get('/reports/outstanding-summary', getPartyOutstandingSummary);
router.get('/reports/receipts', getPartyReceiptsReport);

router.route('/:id')
    .get(getParty)
    .put(updateParty)
    .delete(authorize('admin', 'tenant_owner', 'tenant_admin'), deleteParty);

// ── Ledger routes (new, does not touch existing routes) ───────────────────────
router.get('/:id/balance', getPartyBalance);
router.get('/:id/ledger', getLedger);
router.get('/:id/statement', getPartyStatement);
router.post('/:id/charge', recordCharge);
router.post('/:id/payment', recordPayment);
router.post('/:id/refund', recordRefund);
router.put('/:id/payment/:entryId', authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), updatePayment);
router.delete('/:id/payment/:entryId', authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), deletePayment);
router.post('/:id/unlock', authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), unlockParty);

export default router;
