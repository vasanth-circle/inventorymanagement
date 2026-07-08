import express from 'express';
import {
    connectEcommerceChannel, getEcommerceChannels, triggerSync
} from '../controllers/phase2Controller.js';
import { protect as requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.post('/channels', connectEcommerceChannel);
router.get('/channels', getEcommerceChannels);
router.post('/sync', triggerSync);

export default router;
