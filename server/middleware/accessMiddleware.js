export const checkMenuAccess = (menuName) => {
    return (req, res, next) => {
        const { user } = req;
        const inventoryRole = user.appRoles?.inventory || user.role;

        // 1. Specific menu access check (Highest priority)
        if (user.menuAccess === 'specific') {
            let isAllowed = user.allowedMenus?.includes(menuName) || false;

            // Handle aliases between UI checkboxes and backend menu names
            if (!isAllowed) {
                if (menuName === 'items' && user.allowedMenus?.includes('inventory')) isAllowed = true;
                if (menuName === 'dispatch-management' && user.allowedMenus?.includes('stock-outward')) isAllowed = true;
                if ((menuName === 'reports' || menuName === 'ledger-reports' || menuName === 'profit-tracking') && user.allowedMenus?.includes('reports')) isAllowed = true;
                if (menuName === 'purchases' && user.allowedMenus?.includes('vendors')) isAllowed = true; // Fallback for vendors -> purchases
            }

            if (isAllowed) return next();
            return res.status(403).json({ message: `Access denied: You do not have specific permission for '${menuName}'.` });
        }

        // 2. Full Access overrides
        if (user.menuAccess === 'all') return next();
        
        const fullAccessRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager', 'inventory_admin'];
        if (fullAccessRoles.includes(user.role) || inventoryRole === 'inventory_admin') return next();

        // 3. Apply restrictive roles
        const normalizedRole = inventoryRole?.toLowerCase() || '';
        if (['sales_person', 'sales person', 'sales_user', 'sales user'].includes(normalizedRole) || user.role === 'sales_person') {
            const salesAllowed = ['dashboard', 'items', 'stocks', 'quotations', 'sales-orders', 'dispatch-management', 'customers', 'customer-ledger'];
            if (salesAllowed.includes(menuName)) return next();
            return res.status(403).json({ message: `Access denied for Sales Person` });
        }

        if (normalizedRole === 'accounts' || user.role === 'accounts') {
            const accountsAllowed = ['dashboard', 'items', 'customers', 'vendors', 'customer-ledger', 'vendor-ledger', 'reports'];
            if (accountsAllowed.includes(menuName)) return next();
            return res.status(403).json({ message: `Access denied for Accounts` });
        }

        if (['godown_staff', 'godown staff'].includes(normalizedRole) || user.role === 'godown_staff') {
            const godownAllowed = ['dashboard', 'items', 'stocks', 'dispatch-management', 'stock-adjustment', 'stock-return', 'customers', 'purchases'];
            if (godownAllowed.includes(menuName)) return next();
            return res.status(403).json({ message: `Access denied for Godown Staff` });
        }

        return res.status(403).json({
            message: `Access denied: You do not have permission to access the '${menuName}' menu.`
        });
    };
};
