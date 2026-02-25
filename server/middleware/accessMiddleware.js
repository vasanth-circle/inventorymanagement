export const checkMenuAccess = (menuName) => {
    return (req, res, next) => {
        const { user } = req;

        // Admins have access to everything
        if (user.role === 'admin') {
            return next();
        }

        // Check if user has specific menu access
        if (user.menuAccess === 'all') {
            return next();
        }

        if (user.menuAccess === 'specific' && user.allowedMenus.includes(menuName)) {
            return next();
        }

        return res.status(403).json({
            message: `Access denied: You do not have permission to access the '${menuName}' menu.`
        });
    };
};
