import VendorLedger from '../models/VendorLedger.js';
import Vendor from '../models/Vendor.js';
import User from '../models/User.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';

// @desc    Get ledger for a specific vendor
// @route   GET /api/vendor-ledger/:vendorId
// @access  Private
export const getVendorLedger = async (req, res, next) => {
    try {
        const { vendorId } = req.params;
        const query = { vendor: vendorId, ...tenantQuery(req) };

        const ledger = await VendorLedger.find(query)
            .populate({ path: 'createdBy', model: User, select: 'name email' })
            .sort({ date: -1, createdAt: -1 });

        const vendor = await Vendor.findOne({ _id: vendorId, ...tenantQuery(req) });

        sendResponse(res, 200, { ledger, vendor }, 'Vendor ledger fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Record a manual payment to a vendor
// @route   POST /api/vendor-ledger/payment
// @access  Private
export const recordPayment = async (req, res, next) => {
    try {
        const { vendorId, amount, date, paymentMode, notes, description } = req.body;

        const vendor = await Vendor.findOne({ _id: vendorId, ...tenantQuery(req) });
        if (!vendor) {
            return sendError(res, 404, 'Vendor not found');
        }

        const lastEntry = await VendorLedger.findOne({ vendor: vendorId, ...tenantQuery(req) }).sort({ date: -1, createdAt: -1 });
        const previousBalance = lastEntry ? lastEntry.balance : (vendor.openingBalance || 0);
        
        // Debit reduces our liability (balance)
        const newBalance = previousBalance - amount;

        const ledgerEntry = await VendorLedger.create({
            tenantId: req.tenantId,
            vendor: vendorId,
            date: date || new Date(),
            type: 'payment',
            debit: amount,
            credit: 0,
            balance: newBalance,
            paymentMode: paymentMode || 'cash',
            notes,
            description: description || 'Payment to vendor',
            createdBy: req.user._id,
        });

        // Update vendor current balance
        await Vendor.findByIdAndUpdate(vendorId, { currentBalance: newBalance });

        sendResponse(res, 201, ledgerEntry, 'Payment recorded successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Add manual adjustment to vendor ledger
// @route   POST /api/vendor-ledger/adjustment
// @access  Private
export const addAdjustment = async (req, res, next) => {
    try {
        const { vendorId, amount, type, date, notes, description } = req.body; // type: 'debit' or 'credit'

        const vendor = await Vendor.findOne({ _id: vendorId, ...tenantQuery(req) });
        if (!vendor) {
            return sendError(res, 404, 'Vendor not found');
        }

        const lastEntry = await VendorLedger.findOne({ vendor: vendorId, ...tenantQuery(req) }).sort({ date: -1, createdAt: -1 });
        const previousBalance = lastEntry ? lastEntry.balance : (vendor.openingBalance || 0);
        
        let debit = 0;
        let credit = 0;
        let newBalance = previousBalance;

        if (type === 'debit') {
            debit = amount;
            newBalance -= amount;
        } else {
            credit = amount;
            newBalance += amount;
        }

        const ledgerEntry = await VendorLedger.create({
            tenantId: req.tenantId,
            vendor: vendorId,
            date: date || new Date(),
            type: 'adjustment',
            debit,
            credit,
            balance: newBalance,
            notes,
            description: description || 'Manual Adjustment',
            createdBy: req.user._id,
        });

        await Vendor.findByIdAndUpdate(vendorId, { currentBalance: newBalance });

        sendResponse(res, 201, ledgerEntry, 'Adjustment recorded successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get overall statements and aging for all vendors
// @route   GET /api/vendor-ledger/statements/overall
// @access  Private
export const getVendorOverallStatement = async (req, res, next) => {
    try {
        console.log('Fetching overall vendor statements for tenant:', req.tenantId);
        const query = { ...tenantQuery(req), isActive: true };
        const vendors = await Vendor.find(query).sort({ name: 1 });

        const statements = await Promise.all(vendors.map(async (vendor) => {
            try {
                const entries = await VendorLedger.find({ vendor: vendor._id, ...tenantQuery(req) }).sort({ date: 1, createdAt: 1 });
                
                let totalBilled = 0;
                let totalPaid = 0;
                let currentBalance = vendor.openingBalance || 0;
                let oldestUnpaidBillDate = null;
                
                if (currentBalance > 0) {
                     oldestUnpaidBillDate = vendor.createdAt;
                }

                for (const entry of entries) {
                    totalBilled += (entry.credit || 0);
                    totalPaid += (entry.debit || 0);
                    currentBalance = entry.balance;

                    if (currentBalance <= 0) {
                        oldestUnpaidBillDate = null;
                    } else if (currentBalance > 0 && entry.credit > 0 && !oldestUnpaidBillDate) {
                        oldestUnpaidBillDate = entry.date;
                    }
                }

                let oldestPendingDays = 0;
                if (oldestUnpaidBillDate && currentBalance > 0) {
                    const diffTime = Math.abs(new Date() - new Date(oldestUnpaidBillDate));
                    oldestPendingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                return {
                    vendorId: vendor._id,
                    name: vendor.companyName || vendor.name,
                    contact: vendor.phone,
                    totalBilled,
                    totalPaid,
                    currentBalance,
                    oldestPendingDays
                };
            } catch (innerError) {
                console.error(`Error processing vendor ${vendor._id}:`, innerError);
                return {
                    vendorId: vendor._id,
                    name: (vendor.companyName || vendor.name) + ' (Error)',
                    contact: vendor.phone,
                    totalBilled: 0,
                    totalPaid: 0,
                    currentBalance: vendor.currentBalance || 0,
                    oldestPendingDays: 0
                };
            }
        }));

        sendResponse(res, 200, statements, 'Overall vendor statements fetched');
    } catch (error) {
        console.error('Error in getVendorOverallStatement:', error);
        next(error);
    }
};
