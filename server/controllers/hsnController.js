import HSN from '../models/HSN.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

export const getHSNCodes = async (req, res, next) => {
    try {
        const codes = await HSN.find(tenantQuery(req)).sort({ code: 1 });
        sendResponse(res, 200, codes);
    } catch (error) {
        next(error);
    }
};

export const createHSNCode = async (req, res, next) => {
    try {
        const { code, description, gstRate } = req.body;
        
        const exists = await HSN.findOne({ code: { $regex: new RegExp(`^${code}$`, 'i') }, ...tenantQuery(req) });
        if (exists) {
            return sendError(res, 400, 'HSN code already exists');
        }

        const hsn = await HSN.create({
            code,
            description,
            gstRate,
            tenantId: req.tenantId
        });

        sendResponse(res, 201, hsn, 'HSN code created successfully');
    } catch (error) {
        next(error);
    }
};

export const updateHSNCode = async (req, res, next) => {
    try {
        const { code, description, gstRate } = req.body;
        const hsn = await HSN.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            { code, description, gstRate },
            { new: true, runValidators: true }
        );

        if (!hsn) {
            return sendError(res, 404, 'HSN code not found');
        }

        sendResponse(res, 200, hsn, 'HSN code updated successfully');
    } catch (error) {
        next(error);
    }
};

export const deleteHSNCode = async (req, res, next) => {
    try {
        const hsn = await HSN.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });
        if (!hsn) {
            return sendError(res, 404, 'HSN code not found');
        }
        sendResponse(res, 200, null, 'HSN code deleted successfully');
    } catch (error) {
        next(error);
    }
};
