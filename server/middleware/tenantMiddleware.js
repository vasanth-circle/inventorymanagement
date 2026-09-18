import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import { tenantContext } from '../utils/tenantContext.js';

/**
 * Middleware to check if the tenant (business) is active and has app access.
 * For this simplified version, we'll assume the tenant is identified by a header or from the user's data.
 * In a real multi-tenant app, this would be more complex.
 */
export const checkTenantStatus = async (req, res, next) => {
    try {
        // Skip check for health check and auth routes
        if (req.path === '/health' || req.path.startsWith('/auth')) return next();

        // 1. Identify tenant
        if (req.user && req.user.tenantId) {
            req.tenantId = req.user.tenantId;
            
            // Find tenant object to check status and app access
            const query = {
                $or: [{ tenantId: req.user.tenantId }]
            };
            
            // Only add _id to query if it's a valid ObjectId to avoid CastError
            if (mongoose.Types.ObjectId.isValid(req.user.tenantId)) {
                query.$or.push({ _id: req.user.tenantId });
            }

            const tenant = await Tenant.findOne(query);

            if (tenant) {
                // Determine if inventory app is enabled - handle both Array and Object formats
                let inventoryApp = null;
                const searchNames = ['inventory', 'inventory-api', 'inventory-webapp'];
                
                if (Array.isArray(tenant.apps)) {
                    inventoryApp = tenant.apps.find(app => 
                        searchNames.includes(app.name?.toLowerCase()) || 
                        searchNames.includes(app.slug?.toLowerCase())
                    );
                } else if (tenant.apps && typeof tenant.apps === 'object') {
                    // Try direct key access first
                    for (const name of searchNames) {
                        if (tenant.apps[name]) {
                            inventoryApp = tenant.apps[name];
                            break;
                        }
                    }
                    // Fallback to searching object values
                    if (!inventoryApp) {
                        inventoryApp = Object.values(tenant.apps).find(app => 
                            searchNames.includes(app.name?.toLowerCase()) || 
                            searchNames.includes(app.slug?.toLowerCase())
                        );
                    }
                }

                // Treat Case-insensitive status check
                const status = tenant.status?.toLowerCase();
                const isActiveStatus = ['active', 'trial', 'trialing'].includes(status);
                
                const isAppEnabled = (inventoryApp === true) || (inventoryApp && inventoryApp.enabled !== false);
                
                if (!isAppEnabled || !isActiveStatus) {
                    const appKeys = tenant.apps ? Object.keys(tenant.apps) : 'none';
                    console.warn(`Access denied for tenant ${req.tenantId}: status=${tenant.status}, isAppEnabled=${isAppEnabled}, appKeys=[${appKeys}]`);
                    return res.status(403).json({
                        success: false,
                        message: 'Your access to this application has been disabled. Please contact support.',
                        code: 'TENANT_DISABLED'
                    });
                }
                
                // NEW: Billing Check (Phase 2)
                const now = new Date();
                const isTrialExpired = tenant.billingStatus === 'trialing' && tenant.trialEndsAt && tenant.trialEndsAt < now;
                const isPastDue = tenant.billingStatus === 'past_due' || tenant.billingStatus === 'canceled';

                if (isTrialExpired || isPastDue) {
                    return res.status(402).json({
                        success: false,
                        message: 'Payment Required: Your trial has expired or your subscription is past due. Please update your billing information.',
                        code: 'PAYMENT_REQUIRED',
                        billingStatus: tenant.billingStatus,
                        trialEndsAt: tenant.trialEndsAt
                    });
                }
                
                // Standardize on tenant._id for internal relational mapping (new records)
                req.tenantId = tenant._id;
                // Also store the string code for backward-compatible queries against legacy data
                req.tenantCode = tenant.tenantCode || tenant.tenantId || null;

            } else {
                console.warn(`Tenant object not found in DB for tenantId: ${req.user.tenantId}`);
                // If we have a tenantId from user but no tenant object, we still allow it for now 
                // but log the warning. In a strict system, we would block here.
            }
        }

        tenantContext.run({ tenantId: req.tenantId }, () => next());
    } catch (error) {
        console.error('Tenant Check Error:', error);
        // If DB check fails, we might want to fail-safe or block. Blocking is safer.
        res.status(500).json({
            success: false,
            message: 'Internal server error during access verification.'
        });
    }
};
