import express from 'express';
import { getLedgerByParty, getAllLedgers } from '../controllers/ledgerController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getAllLedgers);
router.get('/:partyId', getLedgerByParty);

export default router;
