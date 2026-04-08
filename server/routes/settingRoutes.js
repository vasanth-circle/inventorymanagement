import express from 'express';
import { getBillingSettings, updateBillingSettings } from '../controllers/settingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/billing', getBillingSettings);
router.patch('/billing', updateBillingSettings);

export default router;
