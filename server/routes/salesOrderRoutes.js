import express from 'express';
import {
    getSalesOrders,
    getSalesOrder,
    createSalesOrder,
    updateSOStatus,
    updateSalesOrder,
    deleteSalesOrder,
    syncSalesOrderLedger,
    recalculateCustomerBalance,
} from '../controllers/salesOrderController.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';
import { authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// router.use(protect); // Global middleware handles this now
router.use(checkMenuAccess('sales-orders'));

router.route('/')
    .get(getSalesOrders)
    .post(createSalesOrder);

router.route('/:id')
    .get(getSalesOrder)
    .put(updateSalesOrder)
    .delete(authorize('admin', 'super_admin', 'tenant_owner', 'tenant_admin'), deleteSalesOrder);

router.route('/:id/status')
    .patch(updateSOStatus);

// Admin route to fix ledger entries for all invoices
router.post('/admin/resync-ledgers', authorize('admin', 'super_admin', 'tenant_owner', 'tenant_admin'), async (req, res) => {
    try {
        const SalesOrder = (await import('../models/SalesOrder.js')).default;
        const Customer = (await import('../models/Customer.js')).default;
        const orders = await SalesOrder.find({ tenantId: req.tenantId, isEstimation: false });
        let fixed = 0;
        for (const order of orders) {
            await syncSalesOrderLedger(order._id, req.tenantId, req.user._id);
            fixed++;
        }
        // Final recalc for all affected customers
        const customers = await Customer.find({ tenantId: req.tenantId }).select('_id');
        for (const c of customers) {
            await recalculateCustomerBalance(c._id.toString(), req.tenantId);
        }
        res.json({ success: true, message: `Re-synced ledger for ${fixed} invoices.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
