import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';

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
        const { name, email, password, companyName } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create Tenant
        const slug = companyName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        const tenantId = `T-${Date.now()}`;
        
        const tenant = await Tenant.create({
            businessName: companyName,
            tenantId: tenantId,
            slug: slug,
            status: 'Trial',
            apps: [{ name: 'inventory', enabled: true }]
        });

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: 'tenant_owner',
            menuAccess: 'all',
            tenantId: tenant.tenantId,
        });

        // Update tenant owner
        tenant.owner = user._id;
        await tenant.save();

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
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
            tenantId: req.user.tenantId, // Automatically associate with requester's tenant
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
        console.log(`Login attempt for email: ${email}`);

        // Check for user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            console.log(`Login failed: User not found for email ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log(`User found: ${user.name || user.email}. Checking password...`);

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`Login failed: Password mismatch for user ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.isActive === false) {
            console.log(`Login failed: User ${email} is inactive`);
            return res.status(401).json({ message: 'User account is inactive' });
        }

        console.log(`Login successful for user: ${email}`);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            menuAccess: user.menuAccess,
            allowedMenus: user.allowedMenus,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error('Login error:', error);
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
        // Only get users belonging to the same tenant
        const users = await User.find({ tenantId: req.user.tenantId });
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

        // Check if user exists and belongs to the same tenant
        const user = await User.findOne({ _id: userId, tenantId: req.user.tenantId });
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

        const user = await User.findOne({ _id: userId, tenantId: req.user.tenantId });
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

        const user = await User.findOne({ _id: userId, tenantId: req.user.tenantId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await User.findOneAndDelete({ _id: userId, tenantId: req.user.tenantId });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
};
