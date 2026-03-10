import express from 'express';
import {
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    upload,
} from '../controllers/itemController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router
    .route('/')
    .get(protect, checkMenuAccess('inventory'), getItems)
    .post(protect, checkMenuAccess('inventory'), upload.single('image'), validateRequest(schemas.createItem), createItem);

router
    .route('/:id')
    .get(protect, checkMenuAccess('inventory'), getItem)
    .put(protect, checkMenuAccess('inventory'), upload.single('image'), updateItem)
    .delete(protect, authorize('admin', 'manager', 'tenant_owner'), checkMenuAccess('inventory'), deleteItem);

export default router;
