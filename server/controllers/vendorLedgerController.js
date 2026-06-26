import VendorLedger from '../models/VendorLedger.js';
import Vendor from '../models/Vendor.js';
import User from '../models/User.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';

/**
 * Helper to recalculate running balance for a vendor's ledger chronologically
 */
export const recalculateVendorBalance = async (vendorId, tenantId) => {
    const vendor = await Vendor.findOne({ _id: vendorId, tenantId });
    if (!vendor) return;

    const entries = await VendorLedger.find({ vendor: vendorId, tenantId })
        .sort({ date: 1, createdAt: 1 });

    let running = vendor.openingBalance || 0;
    for (const entry of entries) {
        // Vendor ledger logic:
        // Credit (e.g. Purchase Bill) INCREASES our liability to them
        // Debit (e.g. Payment made) DECREASES our liability to them
        running = running + (entry.credit || 0) - (entry.debit || 0);
        
        if (entry.balance !== running) {
            entry.balance = running;
            await entry.save();
        }
    }

    await Vendor.findByIdAndUpdate(vendorId, { currentBalance: running });
    return running;
};

// @desc    Get ledger for a specific vendor
// @route   GET /api/vendor-ledger/:vendorId
// @access  Private
export const getVendorLedger = async (req, res, next) => {
    try {
        const { vendorId } = req.params;
        const { from, to } = req.query;
        const query = { vendor: vendorId, ...tenantQuery(req) };

        // Date range filter support
        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        const ledger = await VendorLedger.find(query)
            .populate({ path: 'createdBy', model: User, select: 'name email' })
            .sort({ date: 1, createdAt: 1 });

        const vendor = await Vendor.findOne({ _id: vendorId, ...tenantQuery(req) });

        // Calculate Balance Brought Forward (bbf)
        let bbf = vendor?.openingBalance || 0;
        if (from) {
            const lastPreviousEntry = await VendorLedger.findOne({
                vendor: vendorId,
                ...tenantQuery(req),
                date: { $lt: new Date(from) }
            }).sort({ date: -1, createdAt: -1 });
            if (lastPreviousEntry) {
                bbf = lastPreviousEntry.balance;
            }
        }

        // Last entry balance = current balance
        const lastEntry = await VendorLedger.findOne({ vendor: vendorId, ...tenantQuery(req) })
            .sort({ date: -1, createdAt: -1 });
        const currentBalance = lastEntry ? lastEntry.balance : (vendor?.openingBalance || 0);

        sendResponse(res, 200, { ledger, vendor, bbf, currentBalance }, 'Vendor ledger fetched successfully');
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
        const ledgerEntry = await VendorLedger.create({
            tenantId: req.tenantId,
            vendor: vendorId,
            date: date || new Date(),
            type: 'payment',
            refType: 'Manual',
            refNumber: req.body.refNumber || `PMT-${Date.now()}`,
            debit: amount,
            credit: 0,
            balance: 0, // Set by recalculate
            paymentMode: paymentMode || 'cash',
            notes,
            description: description || 'Payment to vendor',
            createdBy: req.user._id,
        });

        // Update vendor current balance
        const newBalance = await recalculateVendorBalance(vendorId, req.tenantId);
        ledgerEntry.balance = newBalance; // Send back the updated value

        sendResponse(res, 201, ledgerEntry, 'Payment recorded successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update a manual payment made to a vendor
// @route   PUT /api/vendor-ledger/payment/:entryId
// @access  Private (Admin/Manager)
export const updatePayment = async (req, res, next) => {
    try {
        const { amount, paymentMode, date, notes, description, refNumber } = req.body;

        const entry = await VendorLedger.findOne({
            _id: req.params.entryId,
            ...tenantQuery(req),
        });

        if (!entry) return sendError(res, 404, 'Payment entry not found');
        if (entry.refType !== 'Manual') return sendError(res, 400, 'Only manually recorded payments can be edited');
        if (entry.type !== 'payment') return sendError(res, 400, 'Only payment entries can be edited');

        if (amount !== undefined) {
            if (Number(amount) <= 0) return sendError(res, 400, 'Amount must be greater than 0');
            entry.debit = Number(amount);
        }
        if (paymentMode !== undefined) entry.paymentMode = paymentMode;
        if (date !== undefined) entry.date = new Date(date);
        if (notes !== undefined) entry.notes = notes;
        if (description !== undefined) entry.description = description;
        if (refNumber !== undefined) entry.refNumber = refNumber;

        await entry.save();
        
        await recalculateVendorBalance(entry.vendor, req.tenantId);

        sendResponse(res, 200, { entry }, 'Payment updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a manual payment made to a vendor
// @route   DELETE /api/vendor-ledger/payment/:entryId
// @access  Private (Admin/Manager)
export const deletePayment = async (req, res, next) => {
    try {
        const entry = await VendorLedger.findOne({
            _id: req.params.entryId,
            ...tenantQuery(req),
        });

        if (!entry) return sendError(res, 404, 'Payment entry not found');
        if (entry.refType !== 'Manual') return sendError(res, 400, 'Only manually recorded payments can be deleted');
        if (entry.type !== 'payment') return sendError(res, 400, 'Only payment entries can be deleted');

        const vendorId = entry.vendor;
        await VendorLedger.deleteOne({ _id: entry._id });
        
        await recalculateVendorBalance(vendorId, req.tenantId);

        sendResponse(res, 200, null, 'Payment deleted successfully');
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

        const debit = type === 'debit' ? amount : 0;
        const credit = type === 'credit' ? amount : 0;

        const ledgerEntry = await VendorLedger.create({
            tenantId: req.tenantId,
            vendor: vendorId,
            date: date || new Date(),
            type: 'adjustment',
            refType: 'Manual',
            debit,
            credit,
            balance: 0,
            notes,
            description: description || 'Manual Adjustment',
            createdBy: req.user._id,
        });

        const newBalance = await recalculateVendorBalance(vendorId, req.tenantId);
        ledgerEntry.balance = newBalance;

        sendResponse(res, 201, ledgerEntry, 'Adjustment added successfully');
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

// @desc    Get payables report — pending bills owed TO each vendor
// @route   GET /api/vendor-ledger/reports/payables
// @access  Private
export const getVendorPayables = async (req, res, next) => {
    try {
        const query = { ...tenantQuery(req), isActive: true };
        if (req.query.vendor) {
            query._id = req.query.vendor;
        }
        const vendors = await Vendor.find(query).sort({ name: 1 });
        const currentDate = new Date();
        const fromDate = req.query.from ? new Date(req.query.from) : null;
        if (fromDate) fromDate.setHours(0, 0, 0, 0);
        const toDate = req.query.to ? new Date(req.query.to) : null;
        if (toDate) toDate.setHours(23, 59, 59, 999);

        const payablesData = [];

        await Promise.all(vendors.map(async (vendor) => {
            const entries = await VendorLedger.find({ vendor: vendor._id, ...tenantQuery(req) })
                .sort({ date: 1, createdAt: 1 });

            // credit = purchase bill (we owe vendor), debit = we paid
            let totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
            const allPendingBills = [];

            if (vendor.openingBalance > 0) {
                const billDate = new Date(vendor.createdAt);
                if (totalDebits >= vendor.openingBalance) {
                    totalDebits -= vendor.openingBalance;
                } else if (totalDebits > 0) {
                    allPendingBills.push({
                        refNumber: 'Opening Balance',
                        pendingAmount: vendor.openingBalance - totalDebits,
                        date: vendor.createdAt,
                        osDays: Math.floor((currentDate - billDate) / (1000 * 60 * 60 * 24))
                    });
                    totalDebits = 0;
                } else {
                    allPendingBills.push({
                        refNumber: 'Opening Balance',
                        pendingAmount: vendor.openingBalance,
                        date: vendor.createdAt,
                        osDays: Math.floor((currentDate - billDate) / (1000 * 60 * 60 * 24))
                    });
                }
            }

            for (const entry of entries) {
                if (entry.credit > 0) {
                    const billDate = new Date(entry.date);
                    if (totalDebits >= entry.credit) {
                        totalDebits -= entry.credit;
                    } else if (totalDebits > 0) {
                        const pendingAmt = entry.credit - totalDebits;
                        totalDebits = 0;
                        allPendingBills.push({
                            refNumber: entry.refNumber || 'Bill',
                            pendingAmount: pendingAmt,
                            date: entry.date,
                            osDays: Math.floor((currentDate - billDate) / (1000 * 60 * 60 * 24))
                        });
                    } else {
                        allPendingBills.push({
                            refNumber: entry.refNumber || 'Bill',
                            pendingAmount: entry.credit,
                            date: entry.date,
                            osDays: Math.floor((currentDate - billDate) / (1000 * 60 * 60 * 24))
                        });
                    }
                }
            }

            const pendingBills = allPendingBills.filter(bill => {
                const bDate = new Date(bill.date);
                if (fromDate && bDate < fromDate) return false;
                if (toDate && bDate > toDate) return false;
                return true;
            });

            if (pendingBills.length > 0) {
                payablesData.push({
                    vendorId: vendor._id,
                    name: vendor.companyName || vendor.name,
                    contact: vendor.phone,
                    totalPending: pendingBills.reduce((s, b) => s + b.pendingAmount, 0),
                    pendingBills
                });
            }
        }));

        payablesData.sort((a, b) => a.name.localeCompare(b.name));
        sendResponse(res, 200, payablesData, 'Payables report fetched');
    } catch (error) {
        next(error);
    }
};

// @desc    Get outstanding summary for all vendors (Name, Debit, Credit, Closing Balance)
// @route   GET /api/vendor-ledger/reports/outstanding-summary
// @access  Private
export const getVendorOutstandingSummary = async (req, res, next) => {
    try {
        const query = { ...tenantQuery(req), isActive: true };
        const vendors = await Vendor.find(query).sort({ name: 1 });
        const fromDate = req.query.from ? new Date(req.query.from) : null;
        if (fromDate) fromDate.setHours(0, 0, 0, 0);
        const toDate = req.query.to ? new Date(req.query.to) : null;
        if (toDate) toDate.setHours(23, 59, 59, 999);

        const summaries = await Promise.all(vendors.map(async (vendor) => {
            const entryQuery = { vendor: vendor._id, ...tenantQuery(req) };
            if (fromDate || toDate) {
                entryQuery.date = {};
                if (fromDate) entryQuery.date.$gte = fromDate;
                if (toDate) entryQuery.date.$lte = toDate;
            }
            const entries = await VendorLedger.find(entryQuery).sort({ date: 1, createdAt: 1 });
            const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0); // purchases
            const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);   // payments
            const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
            const closingBalance = lastEntry ? lastEntry.balance : (vendor.openingBalance || 0);
            return {
                vendorId: vendor._id,
                name: vendor.companyName || vendor.name,
                phone: vendor.phone,
                totalDebit,
                totalCredit,
                closingBalance
            };
        }));

        sendResponse(res, 200, summaries, 'Vendor outstanding summary fetched');
    } catch (error) {
        next(error);
    }
};
