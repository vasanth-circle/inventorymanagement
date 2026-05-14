import Setting from '../models/Setting.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
            { tenantId: req.tenantId },
            { $set: req.body },
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
