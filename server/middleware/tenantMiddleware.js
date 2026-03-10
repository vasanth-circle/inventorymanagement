import Tenant from '../models/Tenant.js';

/**
 * Middleware to check if the tenant (business) is active and has app access.
 * For this simplified version, we'll assume the tenant is identified by a header or from the user's data.
 * In a real multi-tenant app, this would be more complex.
 */
export const checkTenantStatus = async (req, res, next) => {
    try {
        // Skip check for health check
        if (req.path === '/health') return next();

        // For now, let's assume all users belong to a default tenant or we check by business name.
        // In a production app, the user model would have a tenantId.

        // Let's look for a default tenant if not specified, or just check the first one for demonstration
        // as per the requirement "controlls for the tenent who can access this".

        // Find the "inventory" app status in the core DB
        const tenant = await Tenant.findOne({
            'apps.name': 'inventory'
        });

        if (!tenant) {
            // If no tenant configuration found, we might want to allow it or block it.
            // Based on the screenshot, at least one should exist.
            return next();
        }

        const inventoryApp = tenant.apps.find(app => app.name === 'inventory');

        if (!inventoryApp || !inventoryApp.enabled || tenant.status === 'Inactive' || tenant.status === 'Suspended') {
            return res.status(403).json({
                success: false,
                message: 'Your access to this application has been disabled. Please contact support.',
                code: 'TENANT_DISABLED'
            });
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
