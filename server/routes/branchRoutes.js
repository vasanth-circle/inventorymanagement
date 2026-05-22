import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getBranches,
    getBranch,
    createBranch,
    updateBranch,
    deleteBranch,
    branchStockTransfer,
    getBranchTransferHistory,
} from '../controllers/branchController.js';

const router = express.Router();

// All routes are protected (protect + checkTenantStatus already applied globally in server.js)

router.get('/', getBranches);
router.get('/transfer-history', getBranchTransferHistory);
router.get('/:id', getBranch);

// Admin-only routes
router.post('/', authorize('tenant_admin', 'admin', 'tenant_owner', 'super_admin'), createBranch);
router.put('/:id', authorize('tenant_admin', 'admin', 'tenant_owner', 'super_admin'), updateBranch);
router.delete('/:id', authorize('tenant_admin', 'admin', 'tenant_owner', 'super_admin'), deleteBranch);

// Stock transfer (any authorized user)
router.post('/transfer', branchStockTransfer);

export default router;
