import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
    try {
        const { name, email, password, role, menuAccess, allowedMenus } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'staff',
            menuAccess: menuAccess || 'all',
            allowedMenus: allowedMenus || [],
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            menuAccess: user.menuAccess,
            allowedMenus: user.allowedMenus,
            token: generateToken(user._id),
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new user (admin only)
// @route   POST /api/auth/users
// @access  Private/Admin
export const addUser = async (req, res, next) => {
    try {
        const { name, email, password, role, menuAccess, allowedMenus } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'staff',
            menuAccess: menuAccess || 'all',
            allowedMenus: allowedMenus || [],
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            menuAccess: user.menuAccess,
            allowedMenus: user.allowedMenus,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Check for user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(401).json({ message: 'User account is inactive' });
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            menuAccess: user.menuAccess,
            allowedMenus: user.allowedMenus,
            token: generateToken(user._id),
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        res.json(user);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all users (admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
export const getUsers = async (req, res, next) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        next(error);
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;

            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                menuAccess: updatedUser.menuAccess,
                allowedMenus: updatedUser.allowedMenus,
                token: generateToken(updatedUser._id),
            });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        next(error);
    }
};

// @desc    Update user
// @route   PUT /api/auth/users/:id
// @access  Private/Admin
export const updateUser = async (req, res, next) => {
    try {
        const { name, email, role, menuAccess, allowedMenus } = req.body;
        const userId = req.params.id;

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if email is being changed and if it already exists
        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        // Update user fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;
        if (menuAccess) user.menuAccess = menuAccess;
        if (allowedMenus !== undefined) user.allowedMenus = allowedMenus;

        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            menuAccess: user.menuAccess,
            allowedMenus: user.allowedMenus,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle user status (activate/deactivate)
// @route   PATCH /api/auth/users/:id/status
// @access  Private/Admin
export const toggleUserStatus = async (req, res, next) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deactivating themselves
        if (userId === req.user._id.toString()) {
            return res.status(400).json({ message: 'Cannot deactivate your own account' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isActive = !user.isActive;
        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res, next) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (userId === req.user._id.toString()) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await User.findByIdAndDelete(userId);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
};
