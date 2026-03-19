import Customer from '../models/Customer.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res, next) => {
    try {
        const { search = '', page = 1, limit = 10 } = req.query;
        const query = { tenantId: req.tenantId, isActive: true };

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
        const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
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
            { _id: req.params.id, tenantId: req.tenantId },
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
            { _id: req.params.id, tenantId: req.tenantId },
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
