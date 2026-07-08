import express from 'express';
import {
    createCreditNote,
    getCreditNotes,
    getCreditNote,
    voidCreditNote,
} from '../controllers/phase1Controller.js';

const router = express.Router();

// @route   POST   /api/credit-notes
router.post('/', createCreditNote);

// @route   GET    /api/credit-notes
router.get('/', getCreditNotes);

// @route   GET    /api/credit-notes/:id
router.get('/:id', getCreditNote);

// @route   PUT    /api/credit-notes/:id/void
router.put('/:id/void', voidCreditNote);

export default router;
