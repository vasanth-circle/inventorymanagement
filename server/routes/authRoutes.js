import express from 'express';
import { register, login, getMe, getUsers, addUser, updateUser, toggleUserStatus, deleteUser, updateProfile } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validateRequest, schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router.post('/register', validateRequest(schemas.register), register);
router.post('/login', validateRequest(schemas.login), login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/users', protect, authorize('admin', 'tenant_owner'), getUsers);
router.post('/users', protect, authorize('admin', 'tenant_owner'), validateRequest(schemas.register), addUser);
router.put('/users/:id', protect, authorize('admin', 'tenant_owner'), validateRequest(schemas.updateUser), updateUser);
router.patch('/users/:id/status', protect, authorize('admin', 'tenant_owner'), toggleUserStatus);
router.delete('/users/:id', protect, authorize('admin', 'tenant_owner'), deleteUser);

export default router;
