import express from 'express';
import { register, login, getMe, getUsers, addUser, updateUser, toggleUserStatus, deleteUser, updateProfile } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router.post('/register', validateRequest(schemas.register), register);
router.post('/login', validateRequest(schemas.login), login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/users', authorize('admin', 'tenant_owner', 'tenant_admin'), getUsers);
router.post('/users', authorize('admin', 'tenant_owner', 'tenant_admin'), validateRequest(schemas.register), addUser);
router.put('/users/:id', authorize('admin', 'tenant_owner', 'tenant_admin'), validateRequest(schemas.updateUser), updateUser);
router.patch('/users/:id/status', authorize('admin', 'tenant_owner', 'tenant_admin'), toggleUserStatus);
router.delete('/users/:id', authorize('admin', 'tenant_owner', 'tenant_admin'), deleteUser);

export default router;
