import Role from '../models/Role.js';
import User from '../models/User.js';

// @desc    Get all roles for the current tenant
// @route   GET /api/roles
// @access  Private
export const getRoles = async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ message: 'Tenant context missing' });
        }
        const roles = await Role.find({ tenantId }).sort({ isDefault: -1, createdAt: 1 });
        res.json(roles);
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new role for the current tenant
// @route   POST /api/roles
// @access  Private/Admin
export const createRole = async (req, res, next) => {
    try {
        const { name, description, permissions } = req.body;
        const tenantId = req.user.tenantId;
        if (!tenantId) return res.status(403).json({ message: 'Tenant context missing' });
        if (!name || !name.trim()) return res.status(400).json({ message: 'Role name is required' });

        const exists = await Role.findOne({ tenantId, name: name.trim() });
        if (exists) return res.status(400).json({ message: `Role '${name}' already exists for this tenant` });

        const role = await Role.create({
            tenantId,
            name: name.trim(),
            description: description?.trim() || '',
            permissions: Array.isArray(permissions) ? permissions : [],
            isDefault: false,
        });
        res.status(201).json(role);
    } catch (error) {
        next(error);
    }
};

// @desc    Update a role
// @route   PUT /api/roles/:id
// @access  Private/Admin
export const updateRole = async (req, res, next) => {
    try {
        const { name, description, permissions, isActive } = req.body;
        const tenantId = req.user.tenantId;

        const role = await Role.findOne({ _id: req.params.id, tenantId });
        if (!role) return res.status(404).json({ message: 'Role not found' });

        if (name && name.trim() !== role.name) {
            const exists = await Role.findOne({ tenantId, name: name.trim(), _id: { $ne: role._id } });
            if (exists) return res.status(400).json({ message: `Role '${name}' already exists for this tenant` });
        }

        if (name) role.name = name.trim();
        if (description !== undefined) role.description = description?.trim() || '';
        if (Array.isArray(permissions)) role.permissions = permissions;
        if (isActive !== undefined) role.isActive = isActive;

        await role.save();
        res.json(role);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a role
// @route   DELETE /api/roles/:id
// @access  Private/Admin
export const deleteRole = async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        const role = await Role.findOne({ _id: req.params.id, tenantId });
        if (!role) return res.status(404).json({ message: 'Role not found' });
        if (role.isDefault) return res.status(400).json({ message: 'Cannot delete a default system role' });

        // Unassign role from users first
        await User.updateMany({ roleId: role._id, tenantId }, { $unset: { roleId: '' } });
        await Role.findByIdAndDelete(role._id);
        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        next(error);
    }
};
