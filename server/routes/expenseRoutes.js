import express from 'express';
import {
    getExpenses,
    getExpense,
    createExpense,
    updateExpense,
    deleteExpense
} from '../controllers/expenseController.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

// Require accounts or specific expense access (or just 'accounts' / 'reports' type access)
// Since there's no pre-defined 'expenses' menu in the previous code, we'll use a broad check
// that typically allows admins and managers, or we can use checkMenuAccess('expenses') if added to the system.
// We'll use 'expenses' and if the user has 'all' access they can see it.
router.use(checkMenuAccess('expenses'));

router.route('/')
    .get(getExpenses)
    .post(createExpense);

router.route('/:id')
    .get(getExpense)
    .put(updateExpense)
    .delete(deleteExpense);

export default router;
