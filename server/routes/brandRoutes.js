import express from 'express';
import {
    getBrands,
    createBrand,
    updateBrand,
    deleteBrand,
} from '../controllers/brandController.js';
import { authorize } from '../middleware/authMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router
    .route('/')
    .get(getBrands)
    .post(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), checkMenuAccess('categories'), validateRequest(schemas.createBrand), createBrand);

router
    .route('/:id')
    .put(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), checkMenuAccess('categories'), updateBrand)
    .delete(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), checkMenuAccess('categories'), deleteBrand);

export default router;
