import Customer from '../models/Customer.js';
import CustomerLedger from '../models/CustomerLedger.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res, next) => {
    try {
        const { search = '', page = 1, limit = 10 } = req.query;
        const query = { ...tenantQuery(req), isActive: true };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const customers = await Customer.find(query)
            .sort({ name: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Customer.countDocuments(query);

        sendResponse(res, 200, {
            customers,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalCustomers: total
        }, 'Customers fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
export const getCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!customer) {
            return sendError(res, 404, 'Customer not found');
        }
        sendResponse(res, 200, customer, 'Customer fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.create({ ...req.body, tenantId: req.tenantId });

        sendResponse(res, 201, customer, 'Customer created successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
export const updateCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            req.body,
            {
                new: true,
                runValidators: true
            }
        );
        if (!customer) {
            return sendError(res, 404, 'Customer not found');
        }
        sendResponse(res, 200, customer, 'Customer updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete customer (soft delete)
// @route   DELETE /api/customers/:id
// @access  Private/Admin
export const deleteCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            { isActive: false },
            { new: true }
        );
        if (!customer) {
            return sendError(res, 404, 'Customer not found');
        }
        sendResponse(res, 200, null, 'Customer deleted successfully');
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEDGER FUNCTIONS — New additions, existing functions above are untouched
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get customer's current outstanding balance
// @route   GET /api/customers/:id/balance
// @access  Private
export const getCustomerBalance = async (req, res, next) => {
    try {
        const customer = await Customer.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!customer) return sendError(res, 404, 'Customer not found');

        // Get the last ledger entry to determine running balance
        const lastEntry = await CustomerLedger.findOne({
            customer: req.params.id,
            ...tenantQuery(req),
        }).sort({ date: -1, createdAt: -1 });

        const balance = lastEntry ? lastEntry.balance : (customer.openingBalance || 0);
        sendResponse(res, 200, { balance, customer }, 'Balance fetched');
    } catch (error) {
        next(error);
    }
};

// @desc    Get all ledger entries for a customer
// @route   GET /api/customers/:id/ledger
// @access  Private
export const getCustomerLedger = async (req, res, next) => {
    try {
        const { from, to, page = 1, limit = 50 } = req.query;
        const customer = await Customer.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!customer) return sendError(res, 404, 'Customer not found');

        const query = { customer: req.params.id, ...tenantQuery(req) };
        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        const entries = await CustomerLedger.find(query)
            .sort({ date: 1, createdAt: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('createdBy', 'name');

        const total = await CustomerLedger.countDocuments(query);

        // Last entry's balance = current balance
        const lastEntry = await CustomerLedger.findOne({ customer: req.params.id, ...tenantQuery(req) })
            .sort({ date: -1, createdAt: -1 });
        const currentBalance = lastEntry ? lastEntry.balance : (customer.openingBalance || 0);

        sendResponse(res, 200, {
            customer,
            entries,
            currentBalance,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            total
        }, 'Ledger fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Record a payment received from a customer (credit entry)
// @route   POST /api/customers/:id/payment
// @access  Private
export const recordPayment = async (req, res, next) => {
    try {
        const { amount, paymentMode = 'cash', date, notes, refNumber } = req.body;
        if (!amount || amount <= 0) return sendError(res, 400, 'Payment amount must be greater than 0');

        const customer = await Customer.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!customer) return sendError(res, 404, 'Customer not found');

        // Get current running balance
        const lastEntry = await CustomerLedger.findOne({
            customer: req.params.id,
            ...tenantQuery(req),
        }).sort({ date: -1, createdAt: -1 });
        const previousBalance = lastEntry ? lastEntry.balance : (customer.openingBalance || 0);
        const newBalance = previousBalance - amount;

        // Create credit entry
        const entry = await CustomerLedger.create({
            tenantId: req.tenantId,
            customer: req.params.id,
            date: date ? new Date(date) : new Date(),
            type: 'payment',
            refType: 'Manual',
            refNumber: refNumber || `PMT-${Date.now()}`,
            description: `Payment Received${paymentMode ? ` (${paymentMode.replace('_', ' ')})` : ''}`,
            debit: 0,
            credit: amount,
            balance: newBalance,
            paymentMode,
            notes,
            createdBy: req.user._id,
        });

        // Update customer's currentBalance
        await Customer.findByIdAndUpdate(req.params.id, { currentBalance: newBalance });

        sendResponse(res, 201, { entry, balance: newBalance }, 'Payment recorded successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get full account statement (for printing) with optional date range
// @route   GET /api/customers/:id/statement
// @access  Private
export const getCustomerStatement = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const customer = await Customer.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!customer) return sendError(res, 404, 'Customer not found');

        const query = { customer: req.params.id, ...tenantQuery(req) };
        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        const entries = await CustomerLedger.find(query)
            .sort({ date: 1, createdAt: 1 })
            .populate('createdBy', 'name');

        const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
        const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
        const closingBalance = entries.length > 0 ? entries[entries.length - 1].balance : (customer.openingBalance || 0);

        sendResponse(res, 200, {
            customer,
            entries,
            summary: { totalDebit, totalCredit, closingBalance },
            period: { from: from || null, to: to || null }
        }, 'Statement fetched successfully');
    } catch (error) {
        next(error);
    }
};

