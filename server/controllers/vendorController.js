import Vendor from '../models/Vendor.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private
export const getVendors = async (req, res, next) => {
    try {
        const { search = '', page = 1, limit = 10 } = req.query;
        const query = { isActive: true };

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
        const vendor = await Vendor.findById(req.params.id);
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
        const vendor = await Vendor.create(req.body);
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
        const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!vendor) {
            return sendError(res, 404, 'Vendor not found');
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
        const vendor = await Vendor.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!vendor) {
            return sendError(res, 404, 'Vendor not found');
        }
        sendResponse(res, 200, null, 'Vendor deleted successfully');
    } catch (error) {
        next(error);
    }
};
