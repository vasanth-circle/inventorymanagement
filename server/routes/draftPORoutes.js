import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createDraftPO, getDraftPOs, deleteDraftPO } from '../controllers/draftPOController.js';

const router = express.Router();

router.route('/')
    .post(protect, createDraftPO)
    .get(protect, getDraftPOs);

router.route('/:id')
    .delete(protect, deleteDraftPO);

export default router;
