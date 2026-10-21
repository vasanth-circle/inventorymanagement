import express from 'express';
import { getRoles, createRole, updateRole, deleteRole } from '../controllers/roleController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All role routes require authentication + admin-level access
const adminRoles = ['admin', 'tenant_owner', 'tenant_admin', 'super_admin'];

router.get('/', protect, getRoles);
router.post('/', protect, authorize(...adminRoles), createRole);
router.put('/:id', protect, authorize(...adminRoles), updateRole);
router.delete('/:id', protect, authorize(...adminRoles), deleteRole);

export default router;
