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
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router
    .route('/')
    .get(protect, getItems)
    .post(protect, upload.single('image'), validateRequest(schemas.createItem), createItem);

router
    .route('/:id')
    .get(protect, getItem)
    .put(protect, upload.single('image'), updateItem)
    .delete(protect, authorize('admin', 'manager'), deleteItem);

export default router;
