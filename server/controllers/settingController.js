import Setting from '../models/Setting.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';

export const getBillingSettings = async (req, res, next) => {
    try {
        let settings = await Setting.findOne({ ...tenantQuery(req) });
        
        if (!settings) {
            settings = await Setting.create({
                tenantId: req.tenantId,
                companyName: 'Your Business Name',
                address: 'Your Address',
            });
        }
        
        sendResponse(res, 200, settings, 'Settings fetched successfully');
    } catch (error) {
        next(error);
    }
};

export const updateBillingSettings = async (req, res, next) => {
    try {
        const settings = await Setting.findOneAndUpdate(
            { ...tenantQuery(req) },
            { $set: req.body },
            { new: true, upsert: true }
        );
        
        sendResponse(res, 200, settings, 'Settings updated successfully');
    } catch (error) {
        next(error);
    }
};
