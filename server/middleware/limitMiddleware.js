import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import SalesOrder from '../models/SalesOrder.js';

/**
 * Middleware to check if the tenant has exceeded their user quota.
 */
export const checkUserLimit = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return next();

        const tenant = await Tenant.findById(tenantId).populate('planId');
        
        // If no plan, assume trial or unrestricted for now, or block based on strict business logic
        if (!tenant || !tenant.planId) {
            return next();
        }

        const maxUsers = tenant.planId.maxUsers;
        if (maxUsers > 0) { // 0 means unlimited
            const userCount = await User.countDocuments({ tenantId });
            if (userCount >= maxUsers) {
                return res.status(403).json({
                    success: false,
                    message: `Plan Limit Reached: You have reached the maximum number of users (${maxUsers}) allowed on your current plan. Please upgrade to add more users.`,
                    code: 'LIMIT_EXCEEDED_USERS'
                });
            }
        }
        next();
    } catch (error) {
        console.error('Check User Limit Error:', error);
        next(error);
    }
};

/**
 * Middleware to check if the tenant has exceeded their monthly invoice/sales order quota.
 */
export const checkInvoiceLimit = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return next();

        const tenant = await Tenant.findById(tenantId).populate('planId');
        
        if (!tenant || !tenant.planId) {
            return next();
        }

        const maxInvoices = tenant.planId.maxInvoicesPerMonth;
        if (maxInvoices > 0) {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const invoiceCount = await SalesOrder.countDocuments({
                tenantId,
                createdAt: { $gte: startOfMonth }
            });

            if (invoiceCount >= maxInvoices) {
                return res.status(403).json({
                    success: false,
                    message: `Plan Limit Reached: You have reached the maximum number of invoices (${maxInvoices}) allowed this month. Please upgrade your plan.`,
                    code: 'LIMIT_EXCEEDED_INVOICES'
                });
            }
        }
        next();
    } catch (error) {
        console.error('Check Invoice Limit Error:', error);
        next(error);
    }
};
