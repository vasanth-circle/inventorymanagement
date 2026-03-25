import mongoose from 'mongoose';
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
        const { name, email, password, companyName, phone, termsAccepted } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create Tenant
        const randomStr = Math.random().toString(36).substring(2, 10);
        const baseSlug = companyName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        const slug = `${baseSlug}-${randomStr}`;
        const tenantId = `T-${Date.now()}`;
        
        const tenant = await Tenant.create({
            businessName: companyName,
            tenantId: tenantId,
            slug: slug,
            status: 'Trial',
            contactEmail: email,
            isActive: true,
            apps: {
                proposal: true,
                crm: false,
                hr: false,
                task: true,
                inventory: true,
                billing: false
            },
            config: {
                status: "trial",
                contactEmail: email,
                isActive: true
            }
        });

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            phone,
            termsAccepted: termsAccepted || true,
            role: 'tenant_admin',
            menuAccess: 'all',
            tenantId: tenant.tenantId,
            isActive: true,
            appRoles: {
                crm: null,
                proposal: null,
                hr: null,
                task: null,
                inventory: null,
                billing: null
            }
        });

        // Update tenant owner
        tenant.owner = user._id;
        await tenant.save();

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
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

        // Validate Tenant Status
        if (user.tenantId) {
            const tenantIdStr = user.tenantId.toString();
            
            const tenant = await Tenant.findOne({
                $or: [
                    { tenantId: tenantIdStr },
                    { _id: tenantIdStr }
                ]
            });
            
            if (tenant) {
                // Determine if inventory app is enabled - handle both Array and Object formats
                let inventoryApp = null;
                const searchNames = ['inventory', 'inventory-api', 'inventory-webapp'];
                
                if (Array.isArray(tenant.apps)) {
                    inventoryApp = tenant.apps.find(app => 
                        searchNames.includes(app.name?.toLowerCase()) || 
                        searchNames.includes(app.slug?.toLowerCase())
                    );
                } else if (tenant.apps && typeof tenant.apps === 'object') {
                    // Try direct key access first
                    for (const name of searchNames) {
                        if (tenant.apps[name]) {
                            inventoryApp = tenant.apps[name];
                            break;
                        }
                    }
                    // Fallback to searching object values
                    if (!inventoryApp) {
                        inventoryApp = Object.values(tenant.apps).find(app => 
                            searchNames.includes(app.name?.toLowerCase()) || 
                            searchNames.includes(app.slug?.toLowerCase())
                        );
                    }
                }

                // Treat Case-insensitive status check
                const status = tenant.status?.toLowerCase();
                const isActiveStatus = ['active', 'trial', 'trialing'].includes(status);
                
                const isAppEnabled = (inventoryApp === true) || (inventoryApp && inventoryApp.enabled !== false);
                
                if (!isAppEnabled || !isActiveStatus) {
                    const appKeys = tenant.apps ? Object.keys(tenant.apps) : 'none';
                    console.warn(`Login blocked: Tenant ${tenantIdStr} status=${tenant.status}, isAppEnabled=${isAppEnabled}, appKeys=[${appKeys}]`);
                    return res.status(403).json({
                        message: 'Your access to this application has been disabled or your trial has expired. Please contact support.',
                        code: 'TENANT_DISABLED'
                    });
                }
            } else {
                console.warn(`Login blocked: Tenant ${tenantIdStr} NOT FOUND in core DB for user ${email}`);
                return res.status(403).json({ 
                    message: 'Tenant record not found. Please contact support.'
                });
            }
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
        let query = {};
        
        // Super admin can see all users, others only their own tenant's users
        if (req.user.role !== 'super_admin') {
            if (!req.user.tenantId) {
                console.warn(`getUsers: Non-superadmin user ${req.user.email} has no tenantId`);
                return res.status(403).json({ success: false, message: 'Tenant context missing' });
            }
            query.tenantId = req.user.tenantId;
        }

        const users = await User.find(query).select('-password');
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
