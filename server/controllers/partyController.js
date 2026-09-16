import Party from '../models/Party.js';
import Ledger from '../models/Ledger.js';
import User, { AppUser } from '../models/User.js'; // AppUser registers User on appConn so SalesOrder.populate('user') resolves correctly
import SalesOrder from '../models/SalesOrder.js';
import Setting from '../models/Setting.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { recalculatePartyBalance } from './salesOrderController.js';
// Helper for phone validation
const validatePhoneNumber = (phone) => {
    if (!phone) return null; // allow empty if not required by schema, schema handles required
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!/^\d{10}$/.test(cleanPhone)) return 'Phone number must be exactly 10 digits';
    if (/^(\d)\1{9}$/.test(cleanPhone)) return 'Invalid phone number: all digits are the same';
    const sequential = ['0123456789', '1234567890', '9876543210'];
    if (sequential.includes(cleanPhone)) return 'Invalid phone number: sequential numbers are not allowed';
    return null; // Valid
};

// @access  Private
export const getPartys = async (req, res, next) => {
    try {
        const { search = '', page = 1, limit = 5000 } = req.query;
        const query = { ...tenantQuery(req), isActive: true };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        const partys = await Party.find(query)
            .sort({ name: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Party.countDocuments(query);

        sendResponse(res, 200, {
            partys,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalPartys: total
        }, 'Partys fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get single party
// @route   GET /api/partys/:id
// @access  Private
export const getParty = async (req, res, next) => {
    try {
        const party = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!party) {
            return sendError(res, 404, 'Party not found');
        }
        sendResponse(res, 200, party, 'Party fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Create new party
// @route   POST /api/partys
// @access  Private
export const createParty = async (req, res, next) => {
    try {
        const payload = { ...req.body, tenantId: req.tenantId };
        
        // Phone validation
        if (payload.phone) {
            const error = validatePhoneNumber(payload.phone);
            if (error) return sendError(res, 400, error);
            
            // Duplicate check
            const exists = await Party.findOne({ 
                phone: payload.phone, 
                isActive: true,
                ...tenantQuery(req) 
            });
            if (exists) return sendError(res, 400, 'A party with this phone number already exists');
        }

        if (payload.openingBalance !== undefined) {
            payload.currentBalance = payload.openingBalance;
        }
        const party = await Party.create(payload);

        sendResponse(res, 201, party, 'Party created successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update party
// @route   PUT /api/partys/:id
// @access  Private
export const updateParty = async (req, res, next) => {
    try {
        const payload = { ...req.body };
        
        // Phone validation
        if (payload.phone) {
            const error = validatePhoneNumber(payload.phone);
            if (error) return sendError(res, 400, error);
            
            // Duplicate check
            const exists = await Party.findOne({ 
                _id: { $ne: req.params.id },
                phone: payload.phone, 
                isActive: true,
                ...tenantQuery(req) 
            });
            if (exists) return sendError(res, 400, 'Another party with this phone number already exists');
        }

        if (payload.openingBalance !== undefined) {
            const existing = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
            if (existing) {
                const diff = Number(payload.openingBalance) - (existing.openingBalance || 0);
                if (diff !== 0) {
                    payload.currentBalance = (existing.currentBalance || 0) + diff;
                }
            }
        }

        const party = await Party.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            payload,
            {
                new: true,
                runValidators: true
            }
        );
        if (!party) {
            return sendError(res, 404, 'Party not found');
        }

        if (payload.openingBalance !== undefined) {
            await recalculatePartyBalance(party._id, req.tenantId);
            // Refresh party to get the correct currentBalance after recalculation
            const updatedParty = await Party.findById(party._id);
            return sendResponse(res, 200, updatedParty, 'Party updated successfully');
        }

        sendResponse(res, 200, party, 'Party updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete party (soft delete)
// @route   DELETE /api/partys/:id
// @access  Private/Admin
export const deleteParty = async (req, res, next) => {
    try {
        const party = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!party) {
            return sendError(res, 404, 'Party not found');
        }

        // Prevent deletion if party has a balance
        if (party.currentBalance && party.currentBalance !== 0) {
            return sendError(res, 400, `Cannot delete party with an outstanding balance of ₹${Math.abs(party.currentBalance).toLocaleString('en-IN')}`);
        }

        party.isActive = false;
        await party.save();

        sendResponse(res, 200, null, 'Party deleted successfully');
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEDGER FUNCTIONS — New additions, existing functions above are untouched
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get party's current outstanding balance
// @route   GET /api/partys/:id/balance
// @access  Private
export const getPartyBalance = async (req, res, next) => {
    try {
        const party = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!party) return sendError(res, 404, 'Party not found');

        // Get the last ledger entry to determine running balance
        const lastEntry = await Ledger.findOne({ partyType: 'Party', party: req.params.id,
            ...tenantQuery(req),
        }).sort({ date: -1, createdAt: -1 });

        const balance = lastEntry ? lastEntry.balance : (party.openingBalance || 0);

        let isLocked = false;
        let isManuallyUnlocked = false;

        if (party.unlockedUntil && new Date(party.unlockedUntil) > new Date()) {
            isManuallyUnlocked = true;
        }

        const settings = await Setting.findOne({ tenantId: req.tenantId });
        if (settings?.creditConfig?.enableAutoLock && !isManuallyUnlocked) {
            const creditLimit = settings.creditConfig.partyCreditLimit || 0;
            const creditDays = settings.creditConfig.partyCreditDays || 0;
            
            if (creditLimit > 0 && balance > creditLimit) {
                isLocked = true;
            } else if (creditDays > 0 && balance > 0) {
                const allLedgerEntries = await Ledger.find({ partyType: 'Party', party: party._id, tenantId: req.tenantId }).sort({ date: 1, createdAt: 1 });
                let totalPayments = 0;
                const bills = [];

                if (party.openingBalance > 0) {
                    bills.push({ date: party.createdAt || new Date(0), amount: party.openingBalance });
                } else if (party.openingBalance < 0) {
                    totalPayments += Math.abs(party.openingBalance);
                }

                allLedgerEntries.forEach(entry => {
                    if (entry.debit > 0) bills.push({ date: entry.date, amount: entry.debit });
                    if (entry.credit > 0) totalPayments += entry.credit;
                });

                let oldestUnpaidBillDate = null;
                for (const bill of bills) {
                    if (totalPayments >= bill.amount) {
                        totalPayments -= bill.amount;
                    } else {
                        oldestUnpaidBillDate = bill.date;
                        break;
                    }
                }

                if (oldestUnpaidBillDate) {
                    const diffTime = Math.abs(new Date() - new Date(oldestUnpaidBillDate));
                    const daysPending = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (daysPending > creditDays) {
                        isLocked = true;
                    }
                }
            }
        }

        sendResponse(res, 200, { balance, party, isLocked, isManuallyUnlocked }, 'Balance fetched');
    } catch (error) {
        next(error);
    }
};

// @desc    Get all ledger entries for a party
// @route   GET /api/partys/:id/ledger
// @access  Private
export const getLedger = async (req, res, next) => {
    try {
        const { from, to, page = 1, limit = 10000 } = req.query;
        const party = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!party) return sendError(res, 404, 'Party not found');

        const query = { party: req.params.id, ...tenantQuery(req) };
        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        const entries = await Ledger.find(query)
            .sort({ date: 1, createdAt: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('createdBy', 'name');

        const total = await Ledger.countDocuments(query);

        // Last entry's balance = current balance
        const lastEntry = await Ledger.findOne({ partyType: 'Party', party: req.params.id, ...tenantQuery(req) })
            .sort({ date: -1, createdAt: -1 });
        const currentBalance = lastEntry ? lastEntry.balance : (party.openingBalance || 0);

        // Calculate Balance Brought Forward (bbf)
        let bbf = party.openingBalance || 0;
        if (from) {
            const previousEntries = await Ledger.find({ partyType: 'Party', party: req.params.id,
                ...tenantQuery(req),
                date: { $lt: new Date(from) }
            });
            const priorDebits = previousEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
            const priorCredits = previousEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
            bbf = bbf + priorDebits - priorCredits;
        }

        sendResponse(res, 200, {
            party,
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

// @desc    Record a refund paid to a party (debit entry — reduces party balance)
// @route   POST /api/partys/:id/refund
// @access  Private
export const recordRefund = async (req, res, next) => {
    try {
        const { amount, paymentMode = 'cash', date, notes, refNumber, returnRef } = req.body;
        if (!amount || amount <= 0) return sendError(res, 400, 'Refund amount must be greater than 0');

        const party = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!party) return sendError(res, 404, 'Party not found');

        const auto = returnRef ? `RET-${returnRef}` : `RET-${Date.now()}`;

        const entry = await Ledger.create({ tenantId: req.tenantId, partyType: 'Party', party: req.params.id,
            date: date ? new Date(date) : new Date(),
            type: 'adjustment',
            refType: 'Manual',
            refNumber: refNumber || auto,
            description: `Return Refund${returnRef ? ` (Ref: ${returnRef})` : ''}${paymentMode ? ` — ${paymentMode.replace('_', ' ')}` : ''}`,
            debit: amount,  // Debit the party: reduces their Cr balance / reduces our liability to them
            credit: 0,
            balance: 0,     // Will be set by recalculate
            paymentMode,
            notes,
            createdBy: req.user._id,
        });

        await recalculatePartyBalance(req.params.id, req.tenantId);
        const updatedParty = await Party.findById(req.params.id);

        sendResponse(res, 201, { entry, balance: updatedParty.currentBalance }, 'Refund recorded successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Record a payment received from a party (credit entry)
// @route   POST /api/partys/:id/payment
// @access  Private
// @route   POST /api/partys/:id/charge
// @desc    Record a manual charge/voucher (increases outstanding balance)
// @access  Private
export const recordCharge = async (req, res, next) => {
    try {
        const { amount, date, description, refNumber } = req.body;
        if (!amount || amount <= 0) return sendError(res, 400, 'Charge amount must be greater than 0');
        if (!description || description.trim() === '') return sendError(res, 400, 'Description/Reason is required');

        const party = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!party) return sendError(res, 404, 'Party not found');

        // Create debit entry (increases balance)
        const entry = await Ledger.create({ tenantId: req.tenantId, partyType: 'Party', party: req.params.id,
            date: date || new Date(),
            type: 'adjustment',
            refType: 'Manual',
            refNumber,
            description,
            debit: amount,
            credit: 0,
            createdBy: req.user._id,
        });

        // Recalculate balance from this date onwards
        await recalculatePartyBalance(req.params.id, req.tenantId);

        sendResponse(res, 201, entry, 'Charge recorded successfully');
    } catch (error) {
        next(error);
    }
};

export const recordPayment = async (req, res, next) => {

    try {
        const { amount, paymentMode = 'cash', date, notes, refNumber } = req.body;
        if (!amount || amount <= 0) return sendError(res, 400, 'Payment amount must be greater than 0');

        const party = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!party) return sendError(res, 404, 'Party not found');

        // Get current running balance (temporary for this entry, will be recalculated)
        const lastEntry = await Ledger.findOne({ partyType: 'Party', party: req.params.id,
            ...tenantQuery(req),
        }).sort({ date: -1, createdAt: -1 });
        const previousBalance = lastEntry ? lastEntry.balance : (party.openingBalance || 0);
        const newBalance = previousBalance - amount;

        // Create credit entry
        const entry = await Ledger.create({ tenantId: req.tenantId, partyType: 'Party', party: req.params.id,
            date: date ? new Date(date) : new Date(),
            type: 'payment',
            refType: 'Manual',
            refNumber: refNumber || (paymentMode === 'discount' ? `DISC-${Date.now()}` : `PMT-${Date.now()}`),
            description: paymentMode === 'discount' ? 'Discount / Write-off' : `Payment Received${paymentMode ? ` (${paymentMode.replace('_', ' ')})` : ''}`,
            debit: 0,
            credit: amount,
            balance: 0, // Will be set by recalculate
            paymentMode,
            notes,
            createdBy: req.user._id,
        });

        // Recalculate full ledger chronologically
        await recalculatePartyBalance(req.params.id, req.tenantId);
        
        // Fetch the updated party to get the correct new balance
        const updatedParty = await Party.findById(req.params.id);

        sendResponse(res, 201, { entry, balance: updatedParty.currentBalance }, 'Payment recorded successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update a manually recorded payment entry
// @route   PUT /api/partys/:id/payment/:entryId
// @access  Private (Admin/Manager)
export const updatePayment = async (req, res, next) => {
    try {
        const { amount, paymentMode, date, notes, refNumber } = req.body;

        const entry = await Ledger.findOne({
            _id: req.params.entryId,
            party: req.params.id,
            ...tenantQuery(req),
        });

        if (!entry) return sendError(res, 404, 'Payment entry not found');
        if (entry.refType !== 'Manual') return sendError(res, 400, 'Only manually recorded entries can be edited');
        if (entry.type !== 'payment' && entry.type !== 'adjustment') return sendError(res, 400, 'Only payment or refund entries can be edited');

        if (amount !== undefined) {
            if (Number(amount) <= 0) return sendError(res, 400, 'Amount must be greater than 0');
            if (entry.type === 'adjustment') {
                entry.debit = Number(amount);
            } else {
                entry.credit = Number(amount);
            }
        }
        if (paymentMode !== undefined) {
            entry.paymentMode = paymentMode;
            if (entry.type === 'payment') {
                entry.description = paymentMode === 'discount' ? 'Discount / Write-off' : `Payment Received (${paymentMode.replace('_', ' ')})`;
            }
        }
        if (date !== undefined) entry.date = new Date(date);
        if (notes !== undefined) entry.notes = notes;
        if (refNumber !== undefined) entry.refNumber = refNumber;

        await entry.save();
        await recalculatePartyBalance(req.params.id, req.tenantId);

        const updatedParty = await Party.findById(req.params.id);
        sendResponse(res, 200, { entry, balance: updatedParty.currentBalance }, 'Payment updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a manually recorded payment entry
// @route   DELETE /api/partys/:id/payment/:entryId
// @access  Private (Admin/Manager)
export const deletePayment = async (req, res, next) => {
    try {
        const entry = await Ledger.findOne({
            _id: req.params.entryId,
            party: req.params.id,
            ...tenantQuery(req),
        });

        if (!entry) return sendError(res, 404, 'Entry not found');
        if (entry.refType !== 'Manual') return sendError(res, 400, 'Only manually recorded entries can be deleted');
        if (entry.type !== 'payment' && entry.type !== 'adjustment') return sendError(res, 400, 'Only payment or refund entries can be deleted');

        await Ledger.deleteOne({ _id: entry._id });
        await recalculatePartyBalance(req.params.id, req.tenantId);

        const updatedParty = await Party.findById(req.params.id);
        sendResponse(res, 200, { balance: updatedParty.currentBalance }, 'Payment deleted successfully');
    } catch (error) {
        next(error);
    }
};


// @desc    Get full account statement (for printing) with optional date range
// @route   GET /api/partys/:id/statement
// @access  Private
export const getPartyStatement = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const party = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!party) return sendError(res, 404, 'Party not found');

        const query = { party: req.params.id, ...tenantQuery(req) };
        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        const entries = await Ledger.find(query)
            .sort({ date: 1, createdAt: 1 })
            .populate('createdBy', 'name');

        const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
        const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
        const closingBalance = entries.length > 0 ? entries[entries.length - 1].balance : (party.openingBalance || 0);

        sendResponse(res, 200, {
            party,
            entries,
            summary: { totalDebit, totalCredit, closingBalance },
            period: { from: from || null, to: to || null }
        }, 'Statement fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get overall statements and aging for all partys
// @route   GET /api/partys/statements/overall
// @access  Private
export const getPartyOverallStatement = async (req, res, next) => {
    try {
        console.log('Fetching overall party statements for tenant:', req.tenantId);
        const query = { ...tenantQuery(req), isActive: true };
        const partys = await Party.find(query).sort({ name: 1 });

        const statements = await Promise.all(partys.map(async (party) => {
            try {
                const entries = await Ledger.find({ partyType: 'Party', party: party._id, ...tenantQuery(req) }).sort({ date: 1, createdAt: 1 });
                
                let totalBilled = 0;
                let totalPaid = 0;
                let currentBalance = party.openingBalance || 0;
                let oldestUnpaidBillDate = null;
                
                if (currentBalance > 0) {
                     oldestUnpaidBillDate = party.createdAt;
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
                    partyId: party._id,
                    name: party.companyName || party.name,
                    contact: party.phone,
                    totalBilled,
                    totalPaid,
                    currentBalance,
                    oldestPendingDays
                };
            } catch (innerError) {
                console.error(`Error processing party ${party._id}:`, innerError);
                return {
                    partyId: party._id,
                    name: (party.companyName || party.name) + ' (Error)',
                    contact: party.phone,
                    totalBilled: 0,
                    totalPaid: 0,
                    currentBalance: party.currentBalance || 0,
                    oldestPendingDays: 0
                };
            }
        }));

        sendResponse(res, 200, statements, 'Overall party statements fetched');
    } catch (error) {
        console.error('Error in getPartyOverallStatement:', error);
        next(error);
    }
};

// @desc    Get locked partys
// @route   GET /api/partys/reports/locked
// @access  Private
export const getLockedPartys = async (req, res, next) => {
    try {
        const settings = await Setting.findOne({ tenantId: req.tenantId });
        if (!settings?.creditConfig?.enableAutoLock) {
            return sendResponse(res, 200, [], 'Auto-lock is disabled');
        }

        const creditLimit = settings.creditConfig.partyCreditLimit || 0;
        const creditDays = settings.creditConfig.partyCreditDays || 0;

        const query = { ...tenantQuery(req), isActive: true };
        const partys = await Party.find(query).sort({ name: 1 });

        const lockedPartys = [];

        await Promise.all(partys.map(async (party) => {
            try {
                // Check manual unlock first
                if (party.unlockedUntil && new Date(party.unlockedUntil) > new Date()) {
                    return; // Skip manually unlocked
                }

                const entries = await Ledger.find({ partyType: 'Party', party: party._id, ...tenantQuery(req) }).sort({ date: 1, createdAt: 1 });
                
                let currentBalance = party.openingBalance || 0;
                let totalPayments = 0;
                const bills = [];

                if (party.openingBalance > 0) {
                    bills.push({ date: party.createdAt || new Date(0), amount: party.openingBalance });
                } else if (party.openingBalance < 0) {
                    totalPayments += Math.abs(party.openingBalance);
                }

                for (const entry of entries) {
                    if (entry.debit > 0) bills.push({ date: entry.date, amount: entry.debit });
                    if (entry.credit > 0) totalPayments += entry.credit;
                    currentBalance = entry.balance;
                }

                let oldestUnpaidBillDate = null;
                for (const bill of bills) {
                    if (totalPayments >= bill.amount) {
                        totalPayments -= bill.amount;
                    } else {
                        oldestUnpaidBillDate = bill.date;
                        break;
                    }
                }

                let isLocked = false;
                let oldestPendingDays = 0;

                if (creditLimit > 0 && currentBalance > creditLimit) {
                    isLocked = true;
                } else if (creditDays > 0 && currentBalance > 0 && oldestUnpaidBillDate) {
                    const diffTime = Math.abs(new Date() - new Date(oldestUnpaidBillDate));
                    oldestPendingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (oldestPendingDays > creditDays) {
                        isLocked = true;
                    }
                }

                if (isLocked) {
                    lockedPartys.push({
                        _id: party._id,
                        name: party.companyName || party.name,
                        phone: party.phone,
                        email: party.email,
                        currentBalance,
                        oldestPendingDays,
                        creditLimit,
                        creditDays,
                        unlockedUntil: party.unlockedUntil
                    });
                }
            } catch (innerError) {
                console.error(`Error processing locked status for party ${party._id}:`, innerError);
            }
        }));

        sendResponse(res, 200, lockedPartys, 'Locked partys fetched');
    } catch (error) {
        console.error('Error in getLockedPartys:', error);
        next(error);
    }
};

// @desc    Manually unlock a party for billing
// @route   POST /api/partys/:id/unlock
// @access  Private (Admin/Manager)
export const unlockParty = async (req, res, next) => {
    try {
        const { unlockComment, days = 1 } = req.body;
        if (!unlockComment) {
            return sendError(res, 400, 'Unlock comment/reason is required');
        }

        const party = await Party.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!party) {
            return sendError(res, 404, 'Party not found');
        }

        const unlockDays = Number(days);
        if (isNaN(unlockDays) || unlockDays <= 0) {
            return sendError(res, 400, 'Invalid number of days for unlock');
        }

        // Unlock for specified days from now
        const unlockedUntil = new Date();
        unlockedUntil.setHours(unlockedUntil.getHours() + (24 * unlockDays));

        party.unlockedUntil = unlockedUntil;
        party.unlockComment = unlockComment;
        party.unlockedBy = req.user.id;
        
        await party.save();

        sendResponse(res, 200, party, `Party temporarily unlocked for ${unlockDays} days`);
    } catch (error) {
        next(error);
    }
};

// @desc    Get daywise outstanding/receivables report (pending bills)
// @route   GET /api/partys/reports/receivables
// @access  Private
export const getPartyReceivables = async (req, res, next) => {
    try {
        const query = { ...tenantQuery(req), isActive: true };
        if (req.query.party) {
            query._id = req.query.party;
        }
        const partys = await Party.find(query).sort({ name: 1 });
        const currentDate = new Date();
        const fromDate = req.query.from ? new Date(req.query.from) : null;
        if (fromDate) fromDate.setHours(0, 0, 0, 0);
        const toDate = req.query.to ? new Date(req.query.to) : null;
        if (toDate) toDate.setHours(23, 59, 59, 999);

        const receivablesData = [];

        await Promise.all(partys.map(async (party) => {
            const entries = await Ledger.find({ partyType: 'Party', party: party._id, ...tenantQuery(req) })
                .sort({ date: 1, createdAt: 1 });

            let totalCredits = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
            const allPendingBills = [];
            
            if (party.openingBalance > 0) {
                const billDate = new Date(party.createdAt);
                if (totalCredits >= party.openingBalance) {
                    totalCredits -= party.openingBalance;
                } else if (totalCredits > 0) {
                    allPendingBills.push({
                        refNumber: 'Opening Balance',
                        pendingAmount: party.openingBalance - totalCredits,
                        date: party.createdAt,
                        osDays: Math.floor((currentDate - billDate) / (1000 * 60 * 60 * 24))
                    });
                    totalCredits = 0;
                } else {
                    allPendingBills.push({
                        refNumber: 'Opening Balance',
                        pendingAmount: party.openingBalance,
                        date: party.createdAt,
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
                    partyId: party._id,
                    name: party.companyName || party.name,
                    contact: party.phone,
                    address: [
                        party.address?.billing?.street, 
                        party.address?.billing?.city,
                        party.address?.billing?.state
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

// @desc    Get outstanding summary for all partys (Name, Debit, Credit, Closing Balance)
// @route   GET /api/partys/reports/outstanding-summary
// @access  Private
export const getPartyOutstandingSummary = async (req, res, next) => {
    try {
        const query = { ...tenantQuery(req), isActive: true };

        // Gather sales order IDs if filtering by sales person
        let salesPersonOrderIds = [];
        if (req.query.salesPerson) {
            if (req.query.salesPerson === 'unbilled') {
                const partysWithOrders = await SalesOrder.find({ ...tenantQuery(req) }).distinct('party');
                query._id = { $nin: partysWithOrders };
            } else {
                const salesOrders = await SalesOrder.find({ user: req.query.salesPerson, ...tenantQuery(req) }).select('party _id');
                const partyIds = salesOrders.map(so => so.party);
                salesPersonOrderIds = salesOrders.map(so => so._id.toString());
                query._id = { $in: partyIds };
            }
        }

        const partys = await Party.find(query).sort({ name: 1 });
        const fromDate = req.query.from ? new Date(req.query.from) : null;
        if (fromDate) fromDate.setHours(0, 0, 0, 0);
        const toDate = req.query.to ? new Date(req.query.to) : null;
        if (toDate) toDate.setHours(23, 59, 59, 999);

        const summaries = await Promise.all(partys.map(async (party) => {
            const baseQuery = { party: party._id, ...tenantQuery(req) };
            const openBal = party.openingBalance || 0;

            // All-time ledger entries
            const allEntries = await Ledger.find(baseQuery).sort({ date: 1, createdAt: 1 });
            
            let ledgerDebit = allEntries.reduce((s, e) => s + (e.debit  || 0), 0);
            let ledgerCredit = allEntries.reduce((s, e) => s + (e.credit || 0), 0);

            // Opening balance is stored on Party (not as a ledger entry).
            // If positive = party owes money => add to Debit column.
            // If negative = party paid in advance => add to Credit column.
            const totalDebit  = ledgerDebit  + (openBal > 0 ? openBal : 0);
            const totalCredit = ledgerCredit + (openBal < 0 ? Math.abs(openBal) : 0);

            let closingBalance = 0;

            // Date-filtered entries for closing balance
            const filteredQuery = { ...baseQuery };
            if (fromDate || toDate) {
                filteredQuery.date = {};
                if (fromDate) filteredQuery.date.$gte = fromDate;
                if (toDate)   filteredQuery.date.$lte = toDate;
            }
            
            if (fromDate || toDate) {
                // If filtered by date, recalculate the running balance accurately
                let runningDebit = openBal > 0 ? openBal : 0;
                let runningCredit = openBal < 0 ? Math.abs(openBal) : 0;
                
                const entriesToConsider = await Ledger.find(filteredQuery).sort({ date: 1, createdAt: 1 });

                entriesToConsider.forEach(e => {
                    runningDebit += (e.debit || 0);
                    runningCredit += (e.credit || 0);
                });
                closingBalance = runningDebit - runningCredit;
            } else {
                const lastEntry = allEntries.length > 0 ? allEntries[allEntries.length - 1] : null;
                closingBalance = lastEntry ? lastEntry.balance : openBal;
            }

            // Fetch salesperson name from the most recent sales order for this party
            const latestOrder = await SalesOrder.findOne({ party: party._id, ...tenantQuery(req) })
                .sort({ createdAt: -1 })
                .select('user')
                .populate({ path: 'user', model: User, select: 'name email' });
            const salesPersonName = latestOrder?.user?.name || latestOrder?.user?.email || '';

            return {
                partyId: party._id,
                name: party.companyName || party.name,
                phone: party.phone,
                totalDebit,
                totalCredit,
                closingBalance,
                salesPersonName
            };
        }));

        sendResponse(res, 200, summaries, 'Party outstanding summary fetched');
    } catch (error) {
        next(error);
    }
};

// @desc    Get Party Receipts Report
// @route   GET /api/partys/reports/receipts
// @access  Private
export const getPartyReceiptsReport = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const query = { 
            type: 'payment',
            credit: { $gt: 0 },
            ...tenantQuery(req) 
        };

        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        const receipts = await Ledger.find(query)
            .populate('party', 'name companyName phone')
            .populate('createdBy', 'name')
            .sort({ date: -1, createdAt: -1 });

        sendResponse(res, 200, { receipts }, 'Party receipts report fetched successfully');
    } catch (error) {
        next(error);
    }
};
