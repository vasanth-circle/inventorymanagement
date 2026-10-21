import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password').populate('roleId');

        if (!req.user) {
            return res.status(401).json({ message: 'User not found' });
        }

        if (!req.user.isActive) {
            return res.status(401).json({ message: 'User account is inactive' });
        }

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
        
        console.error('Auth Middleware Error:', error);
        return res.status(500).json({ message: 'Internal server error during authentication' });
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        // super_admin always passes
        if (req.user.role === 'super_admin') return next();

        // Dynamic role check: if user has a roleId with 'all' permission, treat as full access
        if (req.user.roleId && Array.isArray(req.user.roleId.permissions)) {
            if (req.user.roleId.permissions.includes('all')) return next();
        }

        // Static role enum check
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access denied: your role '${req.user.role}' is not authorized for this action`
            });
        }
        next();
    };
};
