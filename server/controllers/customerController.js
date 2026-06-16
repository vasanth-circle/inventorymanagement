import Customer from '../models/Customer.js';
import CustomerLedger from '../models/CustomerLedger.js';
import User from '../models/User.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { recalculateCustomerBalance } from './salesOrderController.js';
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
        const payload = { ...req.body, tenantId: req.tenantId };
        if (payload.openingBalance !== undefined) {
            payload.currentBalance = payload.openingBalance;
        }
        const customer = await Customer.create(payload);

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
        const payload = { ...req.body };
        if (payload.openingBalance !== undefined) {
            const existing = await Customer.findOne({ _id: req.params.id, ...tenantQuery(req) });
            if (existing) {
                const diff = Number(payload.openingBalance) - (existing.openingBalance || 0);
                if (diff !== 0) {
                    payload.currentBalance = (existing.currentBalance || 0) + diff;
                }
            }
        }

        const customer = await Customer.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            payload,
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

        // Calculate Balance Brought Forward (bbf)
        let bbf = customer.openingBalance || 0;
        if (from) {
            const lastPreviousEntry = await CustomerLedger.findOne({
                customer: req.params.id,
                ...tenantQuery(req),
                date: { $lt: new Date(from) }
            }).sort({ date: -1, createdAt: -1 });
            if (lastPreviousEntry) {
                bbf = lastPreviousEntry.balance;
            }
        }

        sendResponse(res, 200, {
            customer,
            entries,
            currentBalance,
            bbf,
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

        // Get current running balance (temporary for this entry, will be recalculated)
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
            balance: 0, // Will be set by recalculate
            paymentMode,
            notes,
            createdBy: req.user._id,
        });

        // Recalculate full ledger chronologically
        await recalculateCustomerBalance(req.params.id, req.tenantId);
        
        // Fetch the updated customer to get the correct new balance
        const updatedCustomer = await Customer.findById(req.params.id);

        sendResponse(res, 201, { entry, balance: updatedCustomer.currentBalance }, 'Payment recorded successfully');
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

// @desc    Get overall statements and aging for all customers
// @route   GET /api/customers/statements/overall
// @access  Private
export const getCustomerOverallStatement = async (req, res, next) => {
    try {
        console.log('Fetching overall customer statements for tenant:', req.tenantId);
        const query = { ...tenantQuery(req), isActive: true };
        const customers = await Customer.find(query).sort({ name: 1 });

        const statements = await Promise.all(customers.map(async (customer) => {
            try {
                const entries = await CustomerLedger.find({ customer: customer._id, ...tenantQuery(req) }).sort({ date: 1, createdAt: 1 });
                
                let totalBilled = 0;
                let totalPaid = 0;
                let currentBalance = customer.openingBalance || 0;
                let oldestUnpaidBillDate = null;
                
                if (currentBalance > 0) {
                     oldestUnpaidBillDate = customer.createdAt;
                }

                for (const entry of entries) {
                    totalBilled += (entry.debit || 0);
                    totalPaid += (entry.credit || 0);
                    currentBalance = entry.balance;

                    if (currentBalance <= 0) {
                        oldestUnpaidBillDate = null;
                    } else if (currentBalance > 0 && entry.debit > 0 && !oldestUnpaidBillDate) {
                        oldestUnpaidBillDate = entry.date;
                    }
                }

                let oldestPendingDays = 0;
                if (oldestUnpaidBillDate && currentBalance > 0) {
                    const diffTime = Math.abs(new Date() - new Date(oldestUnpaidBillDate));
                    oldestPendingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                return {
                    customerId: customer._id,
                    name: customer.companyName || customer.name,
                    contact: customer.phone,
                    totalBilled,
                    totalPaid,
                    currentBalance,
                    oldestPendingDays
                };
            } catch (innerError) {
                console.error(`Error processing customer ${customer._id}:`, innerError);
                return {
                    customerId: customer._id,
                    name: (customer.companyName || customer.name) + ' (Error)',
                    contact: customer.phone,
                    totalBilled: 0,
                    totalPaid: 0,
                    currentBalance: customer.currentBalance || 0,
                    oldestPendingDays: 0
                };
            }
        }));

        sendResponse(res, 200, statements, 'Overall customer statements fetched');
    } catch (error) {
        console.error('Error in getCustomerOverallStatement:', error);
        next(error);
    }
};

// @desc    Manually unlock a customer for billing
// @route   POST /api/customers/:id/unlock
// @access  Private (Admin/Manager)
export const unlockCustomer = async (req, res, next) => {
    try {
        const { unlockComment } = req.body;
        if (!unlockComment) {
            return sendError(res, 400, 'Unlock comment/reason is required');
        }

        const customer = await Customer.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!customer) {
            return sendError(res, 404, 'Customer not found');
        }

        // Unlock for 24 hours from now
        const unlockedUntil = new Date();
        unlockedUntil.setHours(unlockedUntil.getHours() + 24);

        customer.unlockedUntil = unlockedUntil;
        customer.unlockComment = unlockComment;
        customer.unlockedBy = req.user.id;
        
        await customer.save();

        sendResponse(res, 200, customer, 'Customer temporarily unlocked for 24 hours');
    } catch (error) {
        next(error);
    }
};

// @desc    Get daywise outstanding/receivables report (pending bills)
// @route   GET /api/customers/reports/receivables
// @access  Private
export const getCustomerReceivables = async (req, res, next) => {
    try {
        const query = { ...tenantQuery(req), isActive: true };
        if (req.query.customer) {
            query._id = req.query.customer;
        }
        const customers = await Customer.find(query).sort({ name: 1 });
        const currentDate = new Date();
        const fromDate = req.query.from ? new Date(req.query.from) : null;
        if (fromDate) fromDate.setHours(0, 0, 0, 0);
        const toDate = req.query.to ? new Date(req.query.to) : null;
        if (toDate) toDate.setHours(23, 59, 59, 999);

        const receivablesData = [];

        await Promise.all(customers.map(async (customer) => {
            const entries = await CustomerLedger.find({ customer: customer._id, ...tenantQuery(req) })
                .sort({ date: 1, createdAt: 1 });

            let totalCredits = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
            const allPendingBills = [];
            
            if (customer.openingBalance > 0) {
                const billDate = new Date(customer.createdAt);
                if (totalCredits >= customer.openingBalance) {
                    totalCredits -= customer.openingBalance;
                } else if (totalCredits > 0) {
                    allPendingBills.push({
                        refNumber: 'Opening Balance',
                        pendingAmount: customer.openingBalance - totalCredits,
                        date: customer.createdAt,
                        osDays: Math.floor((currentDate - billDate) / (1000 * 60 * 60 * 24))
                    });
                    totalCredits = 0;
                } else {
                    allPendingBills.push({
                        refNumber: 'Opening Balance',
                        pendingAmount: customer.openingBalance,
                        date: customer.createdAt,
                        osDays: Math.floor((currentDate - billDate) / (1000 * 60 * 60 * 24))
                    });
                }
            }

            for (const entry of entries) {
                if (entry.debit > 0) {
                    const billDate = new Date(entry.date);
                    if (totalCredits >= entry.debit) {
                        totalCredits -= entry.debit;
                    } else if (totalCredits > 0) {
                        const pendingAmt = entry.debit - totalCredits;
                        totalCredits = 0;
                        allPendingBills.push({
                            refNumber: entry.refNumber || 'Bill',
                            pendingAmount: pendingAmt,
                            date: entry.date,
                            osDays: Math.floor((currentDate - billDate) / (1000 * 60 * 60 * 24))
                        });
                    } else {
                        allPendingBills.push({
                            refNumber: entry.refNumber || 'Bill',
                            pendingAmount: entry.debit,
                            date: entry.date,
                            osDays: Math.floor((currentDate - billDate) / (1000 * 60 * 60 * 24))
                        });
                    }
                }
            }

            // Filter pending bills by date range if provided
            const pendingBills = allPendingBills.filter(bill => {
                const bDate = new Date(bill.date);
                if (fromDate && bDate < fromDate) return false;
                if (toDate && bDate > toDate) return false;
                return true;
            });

            if (pendingBills.length > 0) {
                receivablesData.push({
                    customerId: customer._id,
                    name: customer.companyName || customer.name,
                    contact: customer.phone,
                    address: [
                        customer.address?.billing?.street, 
                        customer.address?.billing?.city,
                        customer.address?.billing?.state
                    ].filter(Boolean) || [],
                    totalPending: pendingBills.reduce((s, b) => s + b.pendingAmount, 0),
                    pendingBills
                });
            }
        }));

        receivablesData.sort((a, b) => a.name.localeCompare(b.name));

        sendResponse(res, 200, receivablesData, 'Receivables report fetched');
    } catch (error) {
        next(error);
    }
};

