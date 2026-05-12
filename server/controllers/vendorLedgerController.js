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
