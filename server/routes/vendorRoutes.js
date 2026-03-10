import express from 'express';
import {
    getVendors,
    getVendor,
    createVendor,
    updateVendor,
    deleteVendor,
} from '../controllers/vendorController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(checkMenuAccess('purchases')); // Using 'purchases' as menu ID

router.route('/')
    .get(getVendors)
    .post(createVendor);

router.route('/:id')
    .get(getVendor)
    .put(updateVendor)
    .delete(authorize('admin', 'tenant_owner'), deleteVendor);

export default router;
