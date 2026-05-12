import express from 'express';
import { getHSNCodes, createHSNCode, updateHSNCode, deleteHSNCode } from '../controllers/hsnController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getHSNCodes);
router.post('/', checkMenuAccess('hsn'), createHSNCode);
router.put('/:id', checkMenuAccess('hsn'), updateHSNCode);
router.delete('/:id', checkMenuAccess('hsn'), deleteHSNCode);

export default router;
