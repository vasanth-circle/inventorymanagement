import express from 'express';
import { getProfitReport } from '../controllers/profitController.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

// The user must have access to 'reports' menu
router.use(checkMenuAccess('reports'));

router.route('/')
    .get(getProfitReport);

export default router;
