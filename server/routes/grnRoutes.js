import express from 'express';
import {
    createGRN,
    getGRNs,
    getGRNsByPO,
    receiveGRN,
    cancelGRN,
    addLandedCostToPO,
    getLandedCostBreakdown,
} from '../controllers/phase1Controller.js';

const router = express.Router();

// ─── GRN Routes ──────────────────────────────────────────────────────────────

// @route   POST   /api/grn
router.post('/', createGRN);

// @route   GET    /api/grn
router.get('/', getGRNs);

// @route   GET    /api/grn/po/:poId
router.get('/po/:poId', getGRNsByPO);

// @route   PUT    /api/grn/:id/receive
router.put('/:id/receive', receiveGRN);

// @route   PUT    /api/grn/:id/cancel
router.put('/:id/cancel', cancelGRN);

// ─── Landed Cost Routes (mounted under /api/grn for co-location) ──────────────

// @route   PUT    /api/grn/po/:poId/landed-costs
router.put('/po/:poId/landed-costs', addLandedCostToPO);

// @route   GET    /api/grn/po/:poId/landed-cost-breakdown
router.get('/po/:poId/landed-cost-breakdown', getLandedCostBreakdown);

export default router;
