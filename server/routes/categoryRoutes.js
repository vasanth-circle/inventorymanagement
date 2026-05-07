import express from 'express';
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../controllers/categoryController.js';
import { authorize } from '../middleware/authMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router
    .route('/')
    .get(getCategories)
    .post(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), validateRequest(schemas.createCategory), createCategory);

router
    .route('/:id')
    .put(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), updateCategory)
    .delete(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), deleteCategory);

export default router;
