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
        let tenant;
        if (req.user && req.user.tenantId) {
            // Find by user's specific tenantId from core DB
            tenant = await Tenant.findOne({
                $or: [
                    { tenantId: req.user.tenantId },
                    { _id: req.user.tenantId } // In case the ID itself is the tenantId
                ]
            });
        }

        // 2. Fallback to generic inventory app check if no specific user tenant found
        if (!tenant) {
            tenant = await Tenant.findOne({
                'apps.name': 'inventory'
            });
        }

        if (!tenant) {
            console.warn('No tenant configuration found for inventory app');
            return next(); // Fail-open for now or block if strict
        }

        // 3. Check if app is enabled for this tenant
        const inventoryApp = tenant.apps.find(app => app.name === 'inventory');

        if (!inventoryApp || !inventoryApp.enabled || tenant.status === 'Inactive' || tenant.status === 'Suspended') {
            return res.status(403).json({
                success: false,
                message: 'Your access to this application has been disabled. Please contact support.',
                code: 'TENANT_DISABLED'
            });
        }

        // Attach tenantId to request for use in controllers
        req.tenantId = tenant.tenantId || tenant._id;

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
