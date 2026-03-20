import Tenant from '../models/Tenant.js';

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
            console.log(`Tenant identified from user: ${req.tenantId}`);
            
            // Find tenant object to check status and app access
            const tenant = await Tenant.findOne({
                $or: [
                    { tenantId: req.user.tenantId },
                    { _id: req.user.tenantId }
                ]
            });

            if (tenant) {
                // Determine if inventory app is enabled - handle both Array and Object formats
                let inventoryApp = null;
                if (Array.isArray(tenant.apps)) {
                    inventoryApp = tenant.apps.find(app => (app.name === 'inventory' || app.slug === 'inventory'));
                } else if (tenant.apps && typeof tenant.apps === 'object') {
                    // Check for key 'inventory' or an object with name 'inventory'
                    inventoryApp = tenant.apps.inventory || Object.values(tenant.apps).find(app => (app.name === 'inventory' || app.slug === 'inventory'));
                }

                // Treat Active, Trial, Trialing as valid active statuses
                const isActiveStatus = ['Active', 'Trial', 'Trialing'].includes(tenant.status);
                
                if (!inventoryApp || (inventoryApp.enabled === false) || !isActiveStatus) {
                    console.warn(`Access denied for tenant ${req.tenantId}: Status=${tenant.status}, hasApp=${!!inventoryApp}, appEnabled=${inventoryApp?.enabled}`);
                    return res.status(403).json({
                        success: false,
                        message: 'Your access to this application has been disabled or your trial has expired. Please contact support.',
                        code: 'TENANT_DISABLED'
                    });
                }
                
                // Use the standardized tenantId from the tenant object if available
                req.tenantId = tenant.tenantId || tenant._id.toString();
            } else {
                console.warn(`Tenant object not found in DB for tenantId: ${req.user.tenantId}`);
                // If we have a tenantId from user but no tenant object, we still allow it for now 
                // but log the warning. In a strict system, we would block here.
            }
        } else {
            console.warn('No user or tenantId found in request');
        }

        next();
    } catch (error) {
        console.error('Tenant Check Error:', error);
        // If DB check fails, we might want to fail-safe or block. Blocking is safer.
        res.status(500).json({
            success: false,
            message: 'Internal server error during access verification.'
        });
    }
};
