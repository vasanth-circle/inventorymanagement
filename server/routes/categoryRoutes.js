import express from 'express';
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../controllers/categoryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router
    .route('/')
    .get(protect, getCategories)
    .post(protect, authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), validateRequest(schemas.createCategory), createCategory);

router
    .route('/:id')
    .put(protect, authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), updateCategory)
    .delete(protect, authorize('admin', 'tenant_owner', 'tenant_admin'), deleteCategory);

export default router;
