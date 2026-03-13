import express from 'express';
import {
    getLocations,
    createLocation,
    updateLocation,
    deleteLocation,
} from '../controllers/locationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router
    .route('/')
    .get(protect, getLocations)
    .post(protect, authorize('admin', 'tenant_owner'), createLocation);

router
    .route('/:id')
    .put(protect, authorize('admin', 'tenant_owner'), updateLocation)
    .delete(protect, authorize('admin', 'tenant_owner'), deleteLocation);

export default router;
