import express from 'express';
import {
    getLocations,
    createLocation,
    updateLocation,
    deleteLocation,
} from '../controllers/locationController.js';
import { authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router
    .route('/')
    .get(getLocations)
    .post(authorize('admin', 'tenant_owner', 'tenant_admin'), createLocation);

router
    .route('/:id')
    .put(authorize('admin', 'tenant_owner', 'tenant_admin'), updateLocation)
    .delete(authorize('admin', 'tenant_owner', 'tenant_admin'), deleteLocation);

export default router;
