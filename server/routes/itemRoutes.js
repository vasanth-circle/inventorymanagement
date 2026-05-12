import express from 'express';
import {
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    upload,
} from '../controllers/itemController.js';
import { authorize } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router
    .route('/')
    .get(checkMenuAccess('items'), getItems)
    .post(checkMenuAccess('items'), upload.single('image'), validateRequest(schemas.createItem), createItem);

router
    .route('/:id')
    .get(checkMenuAccess('items'), getItem)
    .put(checkMenuAccess('items'), upload.single('image'), updateItem)
    .delete(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), checkMenuAccess('items'), deleteItem);

export default router;
