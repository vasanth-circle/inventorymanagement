import express from 'express';
import {
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerBalance,
    getCustomerLedger,
    recordCharge,
    recordPayment,
    recordRefund,
    updatePayment,
    deletePayment,
    getCustomerStatement,
    getCustomerOverallStatement,
    getLockedCustomers,
    unlockCustomer,
    getCustomerReceivables,
    getCustomerOutstandingSummary,
    getCustomerReceiptsReport
} from '../controllers/customerController.js';
import { authorize } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

// router.use(protect); // Global middleware handles this now
router.use(checkMenuAccess('customers'));

router.route('/')
    .get(getCustomers)
    .post(createCustomer);

router.get('/statements/overall', getCustomerOverallStatement);
router.get('/reports/locked', authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), getLockedCustomers);
router.get('/reports/receivables', getCustomerReceivables);
router.get('/reports/outstanding-summary', getCustomerOutstandingSummary);
router.get('/reports/receipts', getCustomerReceiptsReport);

router.route('/:id')
    .get(getCustomer)
    .put(updateCustomer)
    .delete(authorize('admin', 'tenant_owner', 'tenant_admin'), deleteCustomer);

// ── Ledger routes (new, does not touch existing routes) ───────────────────────
router.get('/:id/balance', getCustomerBalance);
router.get('/:id/ledger', getCustomerLedger);
router.get('/:id/statement', getCustomerStatement);
router.post('/:id/charge', recordCharge);
router.post('/:id/payment', recordPayment);
router.post('/:id/refund', recordRefund);
router.put('/:id/payment/:entryId', authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), updatePayment);
router.delete('/:id/payment/:entryId', authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), deletePayment);
router.post('/:id/unlock', authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), unlockCustomer);

export default router;
