import express from 'express';
import {
    getLocations,
    createLocation,
    updateLocation,
    deleteLocation,
} from '../controllers/locationController.js';
import { authorize } from '../middleware/authMiddleware.js';

import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router
    .route('/')
    .get(getLocations)
    .post(authorize('admin', 'tenant_owner', 'tenant_admin'), validateRequest(schemas.createLocation), createLocation);

router
    .route('/:id')
    .put(authorize('admin', 'tenant_owner', 'tenant_admin'), validateRequest(schemas.updateLocation), updateLocation)
    .delete(authorize('admin', 'tenant_owner', 'tenant_admin'), deleteLocation);

export default router;
