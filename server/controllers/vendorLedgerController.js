import VendorLedger from '../models/VendorLedger.js';
import CustomerLedger from '../models/CustomerLedger.js';
import Vendor from '../models/Vendor.js';
import Customer from '../models/Customer.js';
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
            const baseQuery = { vendor: vendor._id, ...tenantQuery(req) };
            const openBal = vendor.openingBalance || 0;

            // All-time ledger entries
            const allEntries = await VendorLedger.find(baseQuery).sort({ date: 1, createdAt: 1 });
            const ledgerCredit = allEntries.reduce((s, e) => s + (e.credit || 0), 0);
            const ledgerDebit  = allEntries.reduce((s, e) => s + (e.debit  || 0), 0);

            // Opening balance for vendors: positive = company owes vendor => Credit column.
            // Negative = vendor has advance/debit => Debit column.
            const totalCredit = ledgerCredit + (openBal > 0 ? openBal : 0);
            const totalDebit  = ledgerDebit  + (openBal < 0 ? Math.abs(openBal) : 0);

            // Date-filtered entries for closing balance
            const filteredQuery = { ...baseQuery };
            if (fromDate || toDate) {
                filteredQuery.date = {};
                if (fromDate) filteredQuery.date.$gte = fromDate;
                if (toDate)   filteredQuery.date.$lte = toDate;
            }
            const filteredEntries = (fromDate || toDate)
                ? await VendorLedger.find(filteredQuery).sort({ date: 1, createdAt: 1 })
                : allEntries;
            const lastEntry = filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1] : null;
            const closingBalance = lastEntry ? lastEntry.balance : openBal;
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

// @desc    Get combined ledger for a vendor who is also a customer
//          Merges Purchase (VendorLedger) + Sales (CustomerLedger) into one
//          chronological statement with a single net running balance
// @route   GET /api/vendor-ledger/:vendorId/combined
// @access  Private
export const getCombinedLedger = async (req, res, next) => {
    try {
        const { vendorId } = req.params;
        const { from, to } = req.query;

        // 1. Fetch the vendor and verify it has a linked customer
        const vendor = await Vendor.findOne({ _id: vendorId, ...tenantQuery(req) });
        if (!vendor) return sendError(res, 404, 'Vendor not found');
        if (!vendor.linkedCustomerId) {
            return sendError(res, 400, 'This vendor is not linked to a customer account. Please link them first.');
        }

        // 2. Fetch the linked customer
        const customer = await Customer.findOne({ _id: vendor.linkedCustomerId, ...tenantQuery(req) });
        if (!customer) return sendError(res, 404, 'Linked customer not found');

        // 3. Build date filter
        const dateFilter = {};
        if (from || to) {
            dateFilter.date = {};
            if (from) dateFilter.date.$gte = new Date(from);
            if (to)   dateFilter.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        // 4. Fetch both ledgers in parallel
        const [vendorEntries, customerEntries] = await Promise.all([
            VendorLedger.find({ vendor: vendorId, ...tenantQuery(req), ...dateFilter })
                .populate({ path: 'createdBy', model: User, select: 'name email' })
                .sort({ date: 1, createdAt: 1 }),
            CustomerLedger.find({ customer: vendor.linkedCustomerId, ...tenantQuery(req), ...dateFilter })
                .populate({ path: 'createdBy', model: User, select: 'name email' })
                .sort({ date: 1, createdAt: 1 }),
        ]);

        // 5. Compute Balance Brought Forward (BBF) before the date filter
        //    Standard accounting: BBF = net of all prior-period entries
        let bbf = 0;
        if (from) {
            // All vendor entries before date range: Purchase credits increase our liability (+)
            const prevVendorEntries = await VendorLedger.find({
                vendor: vendorId,
                ...tenantQuery(req),
                date: { $lt: new Date(from) },
            }).sort({ date: 1, createdAt: 1 });

            // All customer entries before date range: Sales debits increase their liability to us (+)
            const prevCustomerEntries = await CustomerLedger.find({
                customer: vendor.linkedCustomerId,
                ...tenantQuery(req),
                date: { $lt: new Date(from) },
            }).sort({ date: 1, createdAt: 1 });

            // Opening balances
            const vendorOpeningBal = vendor.openingBalance || 0;
            const customerOpeningBal = customer.openingBalance || 0;

            // Net prior-period balance:
            // Sales side: customer owes us (debit positive, credit negative)
            const salesNet = customerOpeningBal
                + prevCustomerEntries.reduce((s, e) => s + (e.debit || 0) - (e.credit || 0), 0);
            // Purchase side: we owe vendor (credit positive, debit negative)
            const purchaseNet = vendorOpeningBal
                + prevVendorEntries.reduce((s, e) => s + (e.credit || 0) - (e.debit || 0), 0);

            // Net BBF: positive = overall party owes us; negative = we owe party
            bbf = salesNet - purchaseNet;
        } else {
            // No date filter: BBF is the opening balances
            const vendorOpeningBal = vendor.openingBalance || 0;
            const customerOpeningBal = customer.openingBalance || 0;
            bbf = customerOpeningBal - vendorOpeningBal;
        }

        // 6. Tag and merge entries into a single array
        const tagged = [
            ...vendorEntries.map(e => ({
                _id: e._id,
                date: e.date,
                createdAt: e.createdAt,
                source: 'purchase',          // Purchase = Vendor side
                type: e.type,
                refType: e.refType,
                refId: e.refId,
                refNumber: e.refNumber,
                description: e.description,
                paymentMode: e.paymentMode,
                notes: e.notes,
                createdBy: e.createdBy,
                // In combined ledger, purchase bills INCREASE party's claim on us:
                //   Vendor credit (purchase bill) → party earns money from us → net DR to us → shows in 'credit' column
                // Purchase payment (we pay vendor) → party receives money → net CR → shows in 'debit' column
                // Tally-standard: from OUR perspective:
                //   Purchase credit → our payable increases → CREDIT in combined
                //   Purchase debit (payment out) → our payable decreases → DEBIT in combined
                combinedDebit:  e.debit  || 0,   // Payment to vendor = reduces our payable
                combinedCredit: e.credit || 0,   // Purchase bill = increases our payable
            })),
            ...customerEntries.map(e => ({
                _id: e._id,
                date: e.date,
                createdAt: e.createdAt,
                source: 'sales',             // Sales = Customer side
                type: e.type,
                refType: e.refType,
                refId: e.refId,
                refNumber: e.refNumber,
                description: e.description,
                paymentMode: e.paymentMode,
                notes: e.notes,
                createdBy: e.createdBy,
                // Sales bill (customer debit) → party owes us → DEBIT in combined
                // Payment received (customer credit) → party pays us → CREDIT in combined
                combinedDebit:  e.debit  || 0,   // Sales bill = party owes us
                combinedCredit: e.credit || 0,   // Payment received from party
            })),
        ];

        // 7. Sort chronologically
        tagged.sort((a, b) => {
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;
            return new Date(a.createdAt) - new Date(b.createdAt);
        });

        // 8. Compute running net balance
        //    Positive = party owes US (net receivable)
        //    Negative = we owe PARTY (net payable)
        let runningBalance = bbf;
        const combinedLedger = tagged.map(entry => {
            // Sales entries: debit = party owes us (+), credit = they paid us (-)
            // Purchase entries: credit = we owe them (-), debit = we paid them (+)
            if (entry.source === 'sales') {
                runningBalance = runningBalance + (entry.combinedDebit || 0) - (entry.combinedCredit || 0);
            } else {
                // Purchase: bill (credit) reduces our net receivable; payment (debit) increases it
                runningBalance = runningBalance - (entry.combinedCredit || 0) + (entry.combinedDebit || 0);
            }
            return { ...entry, balance: runningBalance };
        });

        // 9. Summary totals
        const salesDebitTotal    = customerEntries.reduce((s, e) => s + (e.debit  || 0), 0);
        const salesCreditTotal   = customerEntries.reduce((s, e) => s + (e.credit || 0), 0);
        const purchaseCreditTotal = vendorEntries.reduce((s, e) => s + (e.credit || 0), 0);
        const purchaseDebitTotal  = vendorEntries.reduce((s, e) => s + (e.debit  || 0), 0);

        const netBalance = combinedLedger.length > 0
            ? combinedLedger[combinedLedger.length - 1].balance
            : bbf;

        sendResponse(res, 200, {
            vendor,
            customer,
            combinedLedger,
            bbf,
            netBalance,
            salesDebitTotal,
            salesCreditTotal,
            purchaseCreditTotal,
            purchaseDebitTotal,
        }, 'Combined ledger fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get Vendor Payments Report
// @route   GET /api/vendor-ledger/reports/payments
// @access  Private
export const getVendorPaymentsReport = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const query = { 
            type: 'payment',
            debit: { $gt: 0 },
            ...tenantQuery(req) 
        };

        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        const payments = await VendorLedger.find(query)
            .populate('vendor', 'name companyName phone')
            .populate('createdBy', 'name')
            .sort({ date: -1, createdAt: -1 });

        sendResponse(res, 200, { payments }, 'Vendor payments report fetched successfully');
    } catch (error) {
        next(error);
    }
};
