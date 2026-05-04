import express from 'express';
import { getPublicProduct } from '../controllers/productShowcaseController.js';

const router = express.Router();

// @route   GET /api/public/product/:slug
// @access  Public (no auth required)
router.get('/product/:slug', getPublicProduct);

export default router;
