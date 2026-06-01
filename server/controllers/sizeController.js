import Size from '../models/Size.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';

export const getSizes = async (req, res, next) => {
    try {
        const sizes = await Size.find(tenantQuery(req)).sort({ createdAt: -1 });
        res.json(sizes);
    } catch (error) {
        next(error);
    }
};

export const createSize = async (req, res, next) => {
    try {
        const exists = await Size.findOne({ name: { $regex: new RegExp(`^${req.body.name}$`, 'i') }, ...tenantQuery(req) });
        if (exists) {
            return sendError(res, 400, 'Size already exists');
        }

        const sizeData = { ...req.body, tenantId: req.tenantId };
        const size = await Size.create(sizeData);
        res.status(201).json(size);
    } catch (error) {
        next(error);
    }
};

export const updateSize = async (req, res, next) => {
    try {
        const size = await Size.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            req.body,
            { new: true, runValidators: true }
        );
        if (!size) return sendError(res, 404, 'Size not found');
        res.json(size);
    } catch (error) {
        next(error);
    }
};

export const deleteSize = async (req, res, next) => {
    try {
        const size = await Size.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });
        if (!size) return sendError(res, 404, 'Size not found');
        res.json({ message: 'Size deleted successfully' });
    } catch (error) {
        next(error);
    }
};
