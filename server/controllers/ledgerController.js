import Ledger from '../models/Ledger.js';
import mongoose from 'mongoose';

export const getLedgerByParty = async (req, res) => {
    try {
        const { partyId } = req.params;
        const { partyType } = req.query; // 'Customer' or 'Vendor'
        const tenantId = req.user.tenantId;

        if (!partyType || !['Customer', 'Vendor'].includes(partyType)) {
            return res.status(400).json({ message: 'Invalid or missing partyType. Must be Customer or Vendor.' });
        }

        const entries = await Ledger.find({
            tenantId,
            party: partyId,
            partyType
        }).sort({ date: 1, createdAt: 1 });

        res.json(entries);
    } catch (error) {
        console.error('Error fetching ledger:', error);
        res.status(500).json({ message: 'Server error fetching ledger' });
    }
};

export const getAllLedgers = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { partyType } = req.query;

        const query = { tenantId };
        if (partyType) query.partyType = partyType;

        const entries = await Ledger.find(query)
            .sort({ date: -1, createdAt: -1 })
            .populate('party', 'name phone email'); // Assuming party resolves correctly. Mongoose might need dynamic refs for full populate, but for now we might handle it frontend or use aggregate.

        // Mongoose generic populate workaround for dynamic ref:
        // Actually, since 'party' isn't explicitly ref'd to a single model in schema, we'd need to populate manually or use virtuals.
        // Let's keep it simple and just return entries for now. 

        res.json(entries);
    } catch (error) {
        console.error('Error fetching all ledgers:', error);
        res.status(500).json({ message: 'Server error fetching all ledgers' });
    }
};

// Helper for recalculating balances (used internally)
export const recalculateLedgerBalance = async (partyId, partyType, tenantId) => {
    const entries = await Ledger.find({
        tenantId,
        party: partyId,
        partyType
    }).sort({ date: 1, createdAt: 1 });

    let runningBalance = 0;
    
    for (const entry of entries) {
        if (partyType === 'Customer') {
            runningBalance += (entry.debit || 0) - (entry.credit || 0);
        } else if (partyType === 'Vendor') {
            // For vendor: credit is when we owe them (bill), debit is when we pay them (payment)
            runningBalance += (entry.credit || 0) - (entry.debit || 0);
        }
        
        if (entry.balance !== runningBalance) {
            entry.balance = runningBalance;
            await entry.save();
        }
    }
    
    return runningBalance;
};
