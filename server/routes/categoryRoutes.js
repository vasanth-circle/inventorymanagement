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
    .post(protect, authorize('admin', 'manager'), validateRequest(schemas.createCategory), createCategory);

router
    .route('/:id')
    .put(protect, authorize('admin', 'manager'), updateCategory)
    .delete(protect, authorize('admin'), deleteCategory);

export default router;
