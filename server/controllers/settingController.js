import Setting from '../models/Setting.js';
import Counter from '../models/Counter.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flattenObject = (obj, prefix = '') => {
    return Object.keys(obj).reduce((acc, k) => {
        const pre = prefix.length ? prefix + '.' : '';
        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
            Object.assign(acc, flattenObject(obj[k], pre + k));
        } else {
            acc[pre + k] = obj[k];
        }
        return acc;
    }, {});
};

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
        // Flatten the object to handle nested updates safely (e.g. branding.tagline)
        // This prevents overwriting the entire branding object and losing logoUrl
        const updateData = flattenObject(req.body);
        
        // Remove protected fields
        delete updateData.tenantId;
        delete updateData._id;

        // PROTECTION: If branding.logoUrl is empty in the request, but exists in the DB, 
        // preserve the existing one to prevent accidental erasure from stale frontend state.
        const currentSettings = await Setting.findOne({ tenantId: req.tenantId });
        if (req.body.branding && (req.body.branding.logoUrl === '' || req.body.branding.logoUrl === undefined)) {
            if (currentSettings?.branding?.logoUrl) {
                updateData['branding.logoUrl'] = currentSettings.branding.logoUrl;
            }
        }

        const settings = await Setting.findOneAndUpdate(
            { tenantId: req.tenantId },
            { $set: updateData },
            { new: true, upsert: true }
        );
        
        sendResponse(res, 200, settings, 'Settings updated successfully');
    } catch (error) {
        console.error('Update Settings Error:', error);
        next(error);
    }
};

export const uploadLogo = async (req, res, next) => {
    try {
        if (!req.file) {
            return sendError(res, 400, 'No file uploaded');
        }

        // Delete old logo if it exists
        const existing = await Setting.findOne({ ...tenantQuery(req) });
        if (existing?.branding?.logoUrl) {
            const oldPath = path.join(__dirname, '..', existing.branding.logoUrl.replace(/^\//, ''));
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (_) {}
            }
        }

        // Build public URL path: /uploads/logos/<filename>
        const logoUrl = `/uploads/logos/${req.file.filename}`;

        const settings = await Setting.findOneAndUpdate(
            { ...tenantQuery(req) },
            { $set: { 'branding.logoUrl': logoUrl } },
            { new: true, upsert: true }
        );

        sendResponse(res, 200, { logoUrl, settings }, 'Logo uploaded successfully');
    } catch (error) {
        next(error);
    }
};

export const deleteLogo = async (req, res, next) => {
    try {
        const existing = await Setting.findOne({ ...tenantQuery(req) });
        if (existing?.branding?.logoUrl) {
            const filePath = path.join(__dirname, '..', existing.branding.logoUrl.replace(/^\//, ''));
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (_) {}
            }
        }

        const settings = await Setting.findOneAndUpdate(
            { ...tenantQuery(req) },
            { $set: { 'branding.logoUrl': '' } },
            { new: true }
        );

        sendResponse(res, 200, { settings }, 'Logo removed successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get current quotation counter value
// @route   GET /api/settings/quotation-counter
// @access  Private
export const getQuotationCounter = async (req, res, next) => {
    try {
        const counter = await Counter.findOne({ id: 'quotation', tenantId: req.tenantId });
        sendResponse(res, 200, { currentValue: counter?.seq || 0 }, 'Counter fetched');
    } catch (error) {
        next(error);
    }
};

// @desc    Reset/Set quotation counter to a specific value
// @route   PATCH /api/settings/quotation-counter
// @access  Private (Admin only)
export const resetQuotationCounter = async (req, res, next) => {
    try {
        const { startFrom } = req.body;
        const newValue = Math.max(0, parseInt(startFrom) - 1); // -1 because getNextSequenceValue increments before use

        await Counter.findOneAndUpdate(
            { id: 'quotation', tenantId: req.tenantId },
            { $set: { seq: newValue } },
            { upsert: true, new: true }
        );

        sendResponse(res, 200, { nextValue: newValue + 1 }, `Quotation counter will start from ${newValue + 1}`);
    } catch (error) {
        next(error);
    }
};
