import express from 'express';
import {
    getLocations,
    createLocation,
    updateLocation,
    deleteLocation,
} from '../controllers/locationController.js';
import { authorize } from '../middleware/authMiddleware.js';

import { validateRequest, schemas } from '../middleware/validateRequest.js';

import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router
    .route('/')
    .get(getLocations)
    .post(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), checkMenuAccess('locations'), validateRequest(schemas.createLocation), createLocation);

router
    .route('/:id')
    .put(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), checkMenuAccess('locations'), validateRequest(schemas.updateLocation), updateLocation)
    .delete(authorize('admin', 'manager', 'tenant_owner', 'tenant_admin'), checkMenuAccess('locations'), deleteLocation);

export default router;
