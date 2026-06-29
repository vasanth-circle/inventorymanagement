import Finish from '../models/Finish.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

// @desc    Get all finishes
// @route   GET /api/finishes
// @access  Private
export const getFinishes = async (req, res, next) => {
    try {
        const finishes = await Finish.find(tenantQuery(req))
            .sort({ name: 1 });
        sendResponse(res, 200, finishes);
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new finish
// @route   POST /api/finishes
// @access  Private
export const createFinish = async (req, res, next) => {
    try {
        const { name, description } = req.body;

        const exists = await Finish.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, ...tenantQuery(req) });
        if (exists) {
            return sendError(res, 400, 'Finish with this name already exists');
        }

        const finish = await Finish.create({
            name,
            description,
            tenantId: req.tenantId,
        });

        sendResponse(res, 201, finish, 'Finish created successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update a finish
// @route   PUT /api/finishes/:id
// @access  Private
export const updateFinish = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        const finish = await Finish.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            { name, description },
            { new: true, runValidators: true }
        );

        if (!finish) {
            return sendError(res, 404, 'Finish not found');
        }

        sendResponse(res, 200, finish, 'Finish updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a finish
// @route   DELETE /api/finishes/:id
// @access  Private
export const deleteFinish = async (req, res, next) => {
    try {
        const finish = await Finish.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });
        if (!finish) {
            return sendError(res, 404, 'Finish not found');
        }
        sendResponse(res, 200, null, 'Finish deleted successfully');
    } catch (error) {
        next(error);
    }
};
