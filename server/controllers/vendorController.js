import Vendor from '../models/Vendor.js';
import VendorLedger from '../models/VendorLedger.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { recalculateVendorBalance } from './vendorLedgerController.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private
export const getVendors = async (req, res, next) => {
    try {
        const { search = '', page = 1, limit = 10 } = req.query;
        const query = { ...tenantQuery(req), isActive: true };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } }
            ];
        }

        const vendors = await Vendor.find(query)
            .sort({ name: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Vendor.countDocuments(query);

        sendResponse(res, 200, {
            vendors,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalVendors: total
        }, 'Vendors fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get single vendor
// @route   GET /api/vendors/:id
// @access  Private
export const getVendor = async (req, res, next) => {
    try {
        const vendor = await Vendor.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!vendor) {
            return sendError(res, 404, 'Vendor not found');
        }
        sendResponse(res, 200, vendor, 'Vendor fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Create new vendor
// @route   POST /api/vendors
// @access  Private
export const createVendor = async (req, res, next) => {
    try {
        const payload = { ...req.body, tenantId: req.tenantId };
        if (payload.linkedCustomerId === '') {
            payload.linkedCustomerId = null;
        }
        if (payload.openingBalance !== undefined) {
            payload.currentBalance = payload.openingBalance;
        }
        const vendor = await Vendor.create(payload);

        // Record opening balance in ledger if it's not zero
        if (payload.openingBalance && Number(payload.openingBalance) > 0) {
            await VendorLedger.create({
                tenantId: req.tenantId,
                vendor: vendor._id,
                date: new Date(),
                type: 'adjustment',
                debit: 0,
                credit: Number(payload.openingBalance),
                balance: Number(payload.openingBalance),
                description: 'Opening Balance',
                createdBy: req.user._id,
            });
        }

        sendResponse(res, 201, vendor, 'Vendor created successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update vendor
// @route   PUT /api/vendors/:id
// @access  Private
export const updateVendor = async (req, res, next) => {
    try {
        const payload = { ...req.body };
        if (payload.linkedCustomerId === '') {
            payload.linkedCustomerId = null;
        }
        if (payload.openingBalance !== undefined) {
            const existing = await Vendor.findOne({ _id: req.params.id, ...tenantQuery(req) });
            if (existing) {
                const diff = Number(payload.openingBalance) - (existing.openingBalance || 0);
                if (diff !== 0) {
                    payload.currentBalance = (existing.currentBalance || 0) + diff;
                }
            }
        }

        const vendor = await Vendor.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            payload,
            {
                new: true,
                runValidators: true
            }
        );
        if (!vendor) {
            return sendError(res, 404, 'Vendor not found');
        }

        if (payload.openingBalance !== undefined) {
            await recalculateVendorBalance(vendor._id, req.tenantId);
            const updatedVendor = await Vendor.findById(vendor._id);
            return sendResponse(res, 200, updatedVendor, 'Vendor updated successfully');
        }

        sendResponse(res, 200, vendor, 'Vendor updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete vendor (soft delete)
// @route   DELETE /api/vendors/:id
// @access  Private/Admin
export const deleteVendor = async (req, res, next) => {
    try {
        const vendorCheck = await Vendor.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!vendorCheck) return sendError(res, 404, 'Vendor not found');
        
        if (vendorCheck.currentBalance && vendorCheck.currentBalance !== 0) {
            return sendError(res, 400, `Cannot delete vendor with an outstanding balance of ₹${Math.abs(vendorCheck.currentBalance).toLocaleString('en-IN')}`);
        }

        // Prevent deletion if vendor has ledger entries
        const hasLedger = await VendorLedger.findOne({ vendor: req.params.id, ...tenantQuery(req) });
        if (hasLedger) {
            return sendError(res, 400, 'Cannot delete vendor with existing ledger entries.');
        }

        // Prevent deletion if vendor has purchase orders
        const hasPO = await PurchaseOrder.findOne({ vendor: req.params.id, ...tenantQuery(req) });
        if (hasPO) {
            return sendError(res, 400, 'Cannot delete vendor with existing purchase orders.');
        }

        const vendor = await Vendor.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            { isActive: false },
            { new: true }
        );
        if (!vendor) {
            return sendError(res, 404, 'Vendor not found');
        }
        sendResponse(res, 200, null, 'Vendor deleted successfully');
    } catch (error) {
        next(error);
    }
};
