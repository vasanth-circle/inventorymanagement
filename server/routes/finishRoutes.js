import express from 'express';
import {
    getFinishes,
    createFinish,
    updateFinish,
    deleteFinish
} from '../controllers/finishController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All routes require authentication

router
    .route('/')
    .get(getFinishes)
    .post(authorize('admin', 'inventory_admin'), createFinish);

router
    .route('/:id')
    .put(authorize('admin', 'inventory_admin'), updateFinish)
    .delete(authorize('admin', 'inventory_admin'), deleteFinish);

export default router;
