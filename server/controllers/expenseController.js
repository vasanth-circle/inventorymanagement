import Expense from '../models/Expense.js';
import User from '../models/User.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { getNextSequenceValue } from '../utils/sequence.js';

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
export const getExpenses = async (req, res, next) => {
    try {
        const { startDate, endDate, category, page = 1, limit = 100 } = req.query;
        const query = { ...tenantQuery(req) };

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        if (category) {
            query.category = category;
        }

        const expenses = await Expense.find(query)
            .populate({ path: 'createdBy', model: User, select: 'name email' })
            .sort({ date: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Expense.countDocuments(query);

        // Calculate totals for summary
        const allExpensesForTotals = await Expense.find(query).select('amount');
        const totalAmount = allExpensesForTotals.reduce((sum, exp) => sum + exp.amount, 0);

        sendResponse(res, 200, {
            expenses,
            totalAmount,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalRecords: total
        }, 'Expenses fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
export const getExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findOne({ _id: req.params.id, ...tenantQuery(req) })
            .populate({ path: 'createdBy', model: User, select: 'name email' });

        if (!expense) {
            return sendError(res, 404, 'Expense voucher not found');
        }
        sendResponse(res, 200, expense, 'Expense fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Create expense
// @route   POST /api/expenses
// @access  Private
export const createExpense = async (req, res, next) => {
    try {
        const { date, category, amount, paymentMethod, description, voucherNumber } = req.body;

        let finalVoucherNumber = voucherNumber;

        // Auto-generate voucher number if not provided manually
        if (!finalVoucherNumber) {
            const seq = await getNextSequenceValue('EXP', req.tenantId);
            finalVoucherNumber = `EXP-${String(seq).padStart(5, '0')}`;
        }

        const expense = await Expense.create({
            date: date || new Date(),
            voucherNumber: finalVoucherNumber,
            category,
            amount,
            paymentMethod,
            description,
            createdBy: req.user._id,
            ...tenantQuery(req)
        });

        sendResponse(res, 201, expense, 'Expense voucher created successfully');
    } catch (error) {
        // If unique error on voucherNumber
        if (error.code === 11000) {
            return sendError(res, 400, 'Expense voucher number already exists. Please use a different one or leave blank to auto-generate.');
        }
        next(error);
    }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
export const updateExpense = async (req, res, next) => {
    try {
        const { date, category, amount, paymentMethod, description } = req.body;

        const expense = await Expense.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!expense) {
            return sendError(res, 404, 'Expense voucher not found');
        }

        expense.date = date || expense.date;
        expense.category = category || expense.category;
        expense.amount = amount !== undefined ? amount : expense.amount;
        expense.paymentMethod = paymentMethod || expense.paymentMethod;
        expense.description = description !== undefined ? description : expense.description;

        await expense.save();

        sendResponse(res, 200, expense, 'Expense voucher updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
export const deleteExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });
        
        if (!expense) {
            return sendError(res, 404, 'Expense voucher not found');
        }

        sendResponse(res, 200, {}, 'Expense voucher deleted successfully');
    } catch (error) {
        next(error);
    }
};
