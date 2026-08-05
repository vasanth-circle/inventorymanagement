import express from 'express';
import { getCustomerTypes, createCustomerType, updateCustomerType, deleteCustomerType } from '../controllers/customerTypeController.js';
import { authorize } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router.use(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'));
// Note: Normally we'd use checkMenuAccess('customerTypes') but for now we allow the roles above globally

router.route('/')
    .get(getCustomerTypes)
    .post(createCustomerType);

router.route('/:id')
    .put(updateCustomerType)
    .delete(deleteCustomerType);

export default router;
