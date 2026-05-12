export const checkMenuAccess = (menuName) => {
    return (req, res, next) => {
        const { user } = req;
        const inventoryRole = user.appRoles?.inventory || user.role;

        // 1. Apply restrictive roles first (Top Priority)
        // If a restrictive app role is assigned, it MUST be enforced
        if (inventoryRole === 'sales_person' || inventoryRole === 'sales person' || inventoryRole === 'sales_user' || inventoryRole === 'sales user' || user.role === 'sales_person') {
            const salesAllowed = ['dashboard', 'items', 'stocks', 'quotations', 'sales-orders', 'dispatch-management', 'customers', 'customer-ledger'];
            if (salesAllowed.includes(menuName)) return next();
            return res.status(403).json({ message: `Access denied for Sales Person` });
        }

        if (inventoryRole === 'accounts' || user.role === 'accounts') {
            const accountsAllowed = ['dashboard', 'items', 'customers', 'vendors', 'customer-ledger', 'vendor-ledger', 'reports'];
            if (accountsAllowed.includes(menuName)) return next();
            return res.status(403).json({ message: `Access denied for Accounts` });
        }

        if (inventoryRole === 'godown_staff' || inventoryRole === 'godown staff' || user.role === 'godown_staff') {
            const godownAllowed = ['dashboard', 'items', 'stocks', 'dispatch-management', 'stock-adjustment', 'stock-return'];
            if (godownAllowed.includes(menuName)) return next();
            return res.status(403).json({ message: `Access denied for Godown Staff` });
        }

        // 2. Full Access overrides (If no restrictive app role is set)
        if (user.menuAccess === 'all') return next();
        
        const fullAccessRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager', 'inventory_admin'];
        if (fullAccessRoles.includes(user.role) || inventoryRole === 'inventory_admin') return next();

        // 3. Custom Menu Access check (if set to specific)
        if (user.menuAccess === 'specific' && user.allowedMenus && user.allowedMenus.includes(menuName)) {
            return next();
        }

        return res.status(403).json({
            message: `Access denied: You do not have permission to access the '${menuName}' menu.`
        });
    };
};
