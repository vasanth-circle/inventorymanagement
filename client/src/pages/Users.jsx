import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Users = () => {
    const { 
        user: currentUser, 
        fetchUsers, 
        addUser, 
        updateUserDetails, 
        changeUserStatus, 
        removeUser, 
        fetchRoles, 
        addRole, 
        updateRoleDetails, 
        removeRole, 
        confirmDelete 
    } = useContext(AuthContext);

    // Active tab: 'users' or 'roles'
    const [activeTab, setActiveTab] = useState('users');

    // Users state
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userFormData, setUserFormData] = useState({ 
        name: '', 
        email: '', 
        phone: '',
        password: '', 
        role: 'staff', 
        roleId: '',
        inventoryRole: 'inventory_user',
        isActive: true,
        menuAccess: 'all', 
        allowedMenus: [] 
    });

    // Roles state
    const [roles, setRoles] = useState([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleFormData, setRoleFormData] = useState({
        name: '',
        description: '',
        permissions: []
    });

    // Permission catalogue
    const permissionCategories = [
        {
            title: 'Core & Overview',
            icon: '📊',
            items: [
                { id: 'dashboard', name: 'Dashboard' },
                { id: 'reports', name: 'Reports Hub' },
                { id: 'action-logs', name: 'Action Logs' },
            ]
        },
        {
            title: 'Inventory & Warehouse',
            icon: '📦',
            items: [
                { id: 'inventory', name: 'Items & Stocks' },
                { id: 'categories', name: 'Categories' },
                { id: 'brands', name: 'Brands' },
                { id: 'finishes', name: 'Finishes' },
                { id: 'sizes', name: 'Sizes / Parts' },
                { id: 'locations', name: 'Locations & Branches' },
                { id: 'stocks', name: 'Stocks Summary' },
                { id: 'stock-inward', name: 'Stock Inward' },
                { id: 'stock-outward', name: 'Stock Outward' },
                { id: 'stock-return', name: 'Stock Returns' },
                { id: 'stock-adjustment', name: 'Stock Adjustment' },
                { id: 'bulk-import', name: 'Bulk Import' },
            ]
        },
        {
            title: 'Sales & Customers',
            icon: '💼',
            items: [
                { id: 'parties', name: 'Parties (Customers & Vendors)' },
                { id: 'customer-types', name: 'Customer Types' },
                { id: 'quotations', name: 'Quotations' },
                { id: 'sales-orders', name: 'Sales Orders' },
                { id: 'dispatch-management', name: 'Dispatch Management' },
            ]
        },
        {
            title: 'Purchases & Procurement',
            icon: '🛒',
            items: [
                { id: 'purchase-orders', name: 'Purchase Entry' },
                { id: 'draft-pos', name: 'Generate PO (Draft)' },
            ]
        },
        {
            title: 'Administration',
            icon: '⚙️',
            items: [
                { id: 'users', name: 'User & Role Management' },
                { id: 'settings', name: 'Company Settings' },
                { id: 'assets', name: 'Asset Management' },
            ]
        }
    ];

    const allPermissionIds = permissionCategories.flatMap(c => c.items.map(i => i.id));

    useEffect(() => {
        loadUsers();
        loadRoles();
    }, []);

    const loadUsers = async () => {
        setLoadingUsers(true);
        const result = await fetchUsers();
        if (result.success) {
            setUsers(result.data);
        } else {
            toast.error(result.message || 'Failed to load users');
        }
        setLoadingUsers(false);
    };

    const loadRoles = async () => {
        setLoadingRoles(true);
        const result = await fetchRoles();
        if (result.success) {
            setRoles(result.data);
        } else {
            // Optional role route might not exist on older instances
            console.error('Role fetch error:', result.message);
        }
        setLoadingRoles(false);
    };

    // --- User Actions ---
    const handleOpenUserModal = (userToEdit = null) => {
        if (userToEdit) {
            setEditingUser(userToEdit);
            setUserFormData({
                name: userToEdit.name || '',
                email: userToEdit.email || '',
                phone: userToEdit.phone || '',
                password: '',
                role: userToEdit.role || 'staff',
                roleId: userToEdit.roleId?._id || userToEdit.roleId || '',
                inventoryRole: userToEdit.appRoles?.inventory || 'inventory_user',
                isActive: userToEdit.isActive !== undefined ? userToEdit.isActive : true,
                menuAccess: userToEdit.menuAccess || 'all',
                allowedMenus: userToEdit.allowedMenus || []
            });
        } else {
            setEditingUser(null);
            setUserFormData({ 
                name: '', 
                email: '', 
                phone: '',
                password: '', 
                role: 'staff', 
                roleId: '',
                inventoryRole: 'inventory_user',
                isActive: true,
                menuAccess: 'all', 
                allowedMenus: [] 
            });
        }
        setIsUserModalOpen(true);
    };

    const handleCloseUserModal = () => {
        setIsUserModalOpen(false);
        setEditingUser(null);
    };

    const handleUserSubmit = async (e) => {
        e.preventDefault();
        let result;
        const payload = { ...userFormData };
        if (!payload.roleId) delete payload.roleId;

        if (editingUser) {
            const { password, ...updateData } = payload;
            result = await updateUserDetails(editingUser._id, updateData);
        } else {
            result = await addUser(payload);
        }

        if (result.success) {
            toast.success(editingUser ? 'User updated successfully' : 'User added successfully');
            loadUsers();
            handleCloseUserModal();
        } else {
            toast.error(result.message);
        }
    };

    const handleToggleStatus = async (id) => {
        const result = await changeUserStatus(id);
        if (result.success) {
            toast.success('User status updated');
            loadUsers();
        } else {
            toast.error(result.message);
        }
    };

    const handleDeleteUser = async (id) => {
        if (id === currentUser?._id) {
            toast.error('You cannot delete your own account');
            return;
        }
        await confirmDelete('Are you sure you want to delete this user?', async () => {
            const result = await removeUser(id);
            if (result.success) {
                toast.success('User deleted successfully');
                loadUsers();
            } else {
                toast.error(result.message);
            }
        });
    };

    // --- Role Actions ---
    const handleOpenRoleModal = (roleToEdit = null) => {
        if (roleToEdit) {
            setEditingRole(roleToEdit);
            setRoleFormData({
                name: roleToEdit.name || '',
                description: roleToEdit.description || '',
                permissions: roleToEdit.permissions || []
            });
        } else {
            setEditingRole(null);
            setRoleFormData({
                name: '',
                description: '',
                permissions: []
            });
        }
        setIsRoleModalOpen(true);
    };

    const handleCloseRoleModal = () => {
        setIsRoleModalOpen(false);
        setEditingRole(null);
    };

    const handleRoleSubmit = async (e) => {
        e.preventDefault();
        if (!roleFormData.name.trim()) {
            toast.error('Role name is required');
            return;
        }

        let result;
        if (editingRole) {
            result = await updateRoleDetails(editingRole._id, roleFormData);
        } else {
            result = await addRole(roleFormData);
        }

        if (result.success) {
            toast.success(editingRole ? 'Role updated successfully' : 'Role created successfully');
            loadRoles();
            handleCloseRoleModal();
        } else {
            toast.error(result.message);
        }
    };

    const handleDeleteRole = async (role) => {
        if (role.isDefault) {
            toast.error('Cannot delete a system default role');
            return;
        }
        await confirmDelete(`Are you sure you want to delete role "${role.name}"? Users assigned this role will revert to standard permissions.`, async () => {
            const result = await removeRole(role._id);
            if (result.success) {
                toast.success('Role deleted successfully');
                loadRoles();
                loadUsers();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleSelectAllPermissions = (selectAll) => {
        setRoleFormData({
            ...roleFormData,
            permissions: selectAll ? allPermissionIds : []
        });
    };

    const handleTogglePermission = (id) => {
        const current = roleFormData.permissions || [];
        const updated = current.includes(id) 
            ? current.filter(p => p !== id) 
            : [...current, id];
        setRoleFormData({ ...roleFormData, permissions: updated });
    };

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Access & Team Management</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage users, create customized tenant roles, and configure precise access permissions.
                    </p>
                </div>

                {/* Primary Action Button */}
                <div>
                    {activeTab === 'users' ? (
                        <button
                            onClick={() => handleOpenUserModal()}
                            className="px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition shadow-sm font-semibold flex items-center space-x-2"
                        >
                            <span>➕</span>
                            <span>Add User</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => handleOpenRoleModal()}
                            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-sm font-semibold flex items-center space-x-2"
                        >
                            <span>🛡️</span>
                            <span>Create Tenant Role</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 space-x-6">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 font-semibold text-sm flex items-center space-x-2 border-b-2 transition-all ${
                        activeTab === 'users'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <span>👥 Team Users</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'users' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                        {users.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('roles')}
                    className={`pb-3 font-semibold text-sm flex items-center space-x-2 border-b-2 transition-all ${
                        activeTab === 'roles'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <span>🛡️ Tenant Roles & Permissions</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'roles' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                        {roles.length}
                    </span>
                </button>
            </div>

            {/* TAB 1: USERS */}
            {activeTab === 'users' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User Details</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Custom Tenant Role</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">System Role</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loadingUsers ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                                            <span>Loading users...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length > 0 ? (
                                users.map((u) => {
                                    const roleObj = typeof u.roleId === 'object' ? u.roleId : roles.find(r => r._id === u.roleId);
                                    return (
                                        <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900">{u.name}</span>
                                                    <span className="text-xs text-gray-500">{u.email}</span>
                                                    {u.phone && <span className="text-xs text-blue-600 font-medium mt-0.5">📞 {u.phone}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {roleObj ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                        🛡️ {roleObj.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">
                                                        Standard (No Custom Role)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                                    ['admin', 'super_admin', 'tenant_owner', 'tenant_admin'].includes(u.role) ? 'bg-purple-100 text-purple-800' : 
                                                    u.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                                                    u.role === 'sales_person' ? 'bg-orange-100 text-orange-800' :
                                                    u.role === 'accounts' ? 'bg-emerald-100 text-emerald-800' :
                                                    u.role === 'godown_staff' ? 'bg-amber-100 text-amber-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {u.role?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                    {u.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium space-x-3">
                                                <button onClick={() => handleOpenUserModal(u)} className="text-primary-600 hover:text-primary-900 font-semibold">Edit</button>
                                                <button onClick={() => handleToggleStatus(u._id)} className={`font-semibold ${u.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}>
                                                    {u.isActive ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button onClick={() => handleDeleteUser(u._id)} className="text-red-600 hover:text-red-900 font-semibold">Delete</button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <span className="text-4xl mb-2">👥</span>
                                            <p className="text-lg font-medium">No users found</p>
                                            <p className="text-sm">Add your first team member to get started.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB 2: ROLES & PERMISSIONS */}
            {activeTab === 'roles' && (
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-100 flex items-start space-x-3">
                        <span className="text-2xl">💡</span>
                        <div className="text-sm text-indigo-950">
                            <strong className="font-bold">Tenant-Specific Roles:</strong> Custom roles created here are strictly private to your tenant workspace. You can define specific permissions (e.g. Sales, Store Keeping, Billing, Auditing) and assign them to any team member.
                        </div>
                    </div>

                    {loadingRoles ? (
                        <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-200">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                            <span>Loading tenant roles...</span>
                        </div>
                    ) : roles.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {roles.map(role => {
                                const assignedUserCount = users.filter(u => {
                                    const rId = typeof u.roleId === 'object' ? u.roleId?._id : u.roleId;
                                    return rId === role._id;
                                }).length;

                                return (
                                    <div key={role._id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-lg">🛡️</span>
                                                    <h3 className="font-bold text-gray-900 text-base">{role.name}</h3>
                                                </div>
                                                {role.isDefault && (
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mb-3 min-h-[32px]">
                                                {role.description || 'Custom tenant role with tailored permission set.'}
                                            </p>

                                            <div className="mb-3">
                                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                                    Permissions ({role.permissions?.includes('all') ? 'Full Access' : (role.permissions?.length || 0)})
                                                </div>
                                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                                    {role.permissions?.includes('all') ? (
                                                        <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium">
                                                            ★ Full System Access
                                                        </span>
                                                    ) : role.permissions && role.permissions.length > 0 ? (
                                                        role.permissions.map(perm => (
                                                            <span key={perm} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                                                {perm}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">No specific permissions</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                                            <span className="text-gray-500 font-medium">
                                                👥 {assignedUserCount} {assignedUserCount === 1 ? 'user' : 'users'} assigned
                                            </span>
                                            <div className="space-x-3">
                                                <button
                                                    onClick={() => handleOpenRoleModal(role)}
                                                    className="font-semibold text-indigo-600 hover:text-indigo-800"
                                                >
                                                    Edit
                                                </button>
                                                {!role.isDefault && (
                                                    <button
                                                        onClick={() => handleDeleteRole(role)}
                                                        className="font-semibold text-red-600 hover:text-red-800"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-200">
                            <span className="text-4xl mb-2 block">🛡️</span>
                            <h3 className="text-lg font-bold text-gray-800">No Custom Roles Yet</h3>
                            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto mb-4">
                                Create dedicated roles like "Store Manager", "Accountant", or "Sales Executive" to restrict or grant permissions to modules.
                            </p>
                            <button
                                onClick={() => handleOpenRoleModal()}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold text-sm transition"
                            >
                                + Create First Role
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* USER MODAL */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingUser ? 'Edit User Details & Role' : 'Add New Team Member'}
                            </h2>
                            <button onClick={handleCloseUserModal} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        
                        <form onSubmit={handleUserSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                                    <input 
                                        type="text" 
                                        value={userFormData.name} 
                                        onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })} 
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" 
                                        required 
                                        placeholder="John Doe" 
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                                    <input 
                                        type="email" 
                                        value={userFormData.email} 
                                        onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })} 
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" 
                                        required 
                                        placeholder="john@example.com" 
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                                    <input 
                                        type="tel" 
                                        value={userFormData.phone} 
                                        onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })} 
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" 
                                        placeholder="e.g. +91 98765 43210" 
                                    />
                                </div>
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Initial Password</label>
                                    <input 
                                        type="password" 
                                        value={userFormData.password} 
                                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })} 
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" 
                                        required 
                                        placeholder="Min 6 characters" 
                                    />
                                </div>
                            )}

                            {/* TENANT CUSTOM ROLE SELECTOR */}
                            <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100">
                                <label className="block text-sm font-bold text-indigo-950 mb-1">
                                    🛡️ Assign Custom Tenant Role
                                </label>
                                <p className="text-xs text-indigo-700 mb-2">
                                    Attaches customized permissions configured in your tenant role matrix.
                                </p>
                                <select 
                                    value={userFormData.roleId} 
                                    onChange={(e) => setUserFormData({ ...userFormData, roleId: e.target.value })} 
                                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800 text-sm"
                                >
                                    <option value="">-- No Custom Role (Use Standard System Role) --</option>
                                    {roles.map(r => (
                                        <option key={r._id} value={r._id}>
                                            {r.name} {r.permissions?.includes('all') ? '(Full Access)' : `(${r.permissions?.length || 0} permissions)`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Fallback System Role</label>
                                    <select 
                                        value={userFormData.role} 
                                        onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })} 
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-sm"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="manager">Manager</option>
                                        <option value="sales_person">Sales Person</option>
                                        <option value="accounts">Accounts</option>
                                        <option value="godown_staff">Godown Staff</option>
                                        <option value="staff">Staff Member</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Inventory App Level</label>
                                    <select 
                                        value={userFormData.inventoryRole} 
                                        onChange={(e) => setUserFormData({ ...userFormData, inventoryRole: e.target.value })} 
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-sm"
                                    >
                                        <option value="inventory_admin">App Admin</option>
                                        <option value="manager">Manager</option>
                                        <option value="sales_person">Sales Person</option>
                                        <option value="accounts">Accounts</option>
                                        <option value="godown_staff">Godown Staff</option>
                                        <option value="inventory_user">App User</option>
                                        <option value="none">No Access</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 py-2">
                                <input 
                                    type="checkbox" 
                                    id="isActive"
                                    checked={userFormData.isActive} 
                                    onChange={(e) => setUserFormData({ ...userFormData, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="isActive" className="text-sm font-semibold text-gray-700">User is Active and can Login</label>
                            </div>

                            <div className="pt-2 border-t border-gray-100">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Direct Menu Access Override</label>
                                <div className="flex space-x-4 mb-3">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="menuAccess" 
                                            checked={userFormData.menuAccess === 'all'} 
                                            onChange={() => setUserFormData({ ...userFormData, menuAccess: 'all' })} 
                                            className="text-primary-600 focus:ring-primary-500" 
                                        />
                                        <span className="text-sm">Standard / All</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="menuAccess" 
                                            checked={userFormData.menuAccess === 'specific'} 
                                            onChange={() => setUserFormData({ ...userFormData, menuAccess: 'specific' })} 
                                            className="text-primary-600 focus:ring-primary-500" 
                                        />
                                        <span className="text-sm">Specific Menus</span>
                                    </label>
                                </div>

                                {userFormData.menuAccess === 'specific' && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 max-h-48 overflow-y-auto">
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                            {allPermissionIds.map(permId => (
                                                <label key={permId} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={userFormData.allowedMenus.includes(permId)}
                                                        onChange={(e) => {
                                                            const newMenus = e.target.checked
                                                                ? [...userFormData.allowedMenus, permId]
                                                                : userFormData.allowedMenus.filter(id => id !== permId);
                                                            setUserFormData({ ...userFormData, allowedMenus: newMenus });
                                                        }}
                                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span className="text-gray-700 capitalize">{permId.replace('-', ' ')}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex space-x-3 pt-4 border-t border-gray-100">
                                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-bold shadow-md">
                                    {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                                <button type="button" onClick={handleCloseUserModal} className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition font-bold">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ROLE MODAL */}
            {isRoleModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 bg-indigo-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">
                                    {editingRole ? 'Edit Tenant Role' : 'Create New Tenant Role'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Set role name and check all the module permissions this role should have.
                                </p>
                            </div>
                            <button onClick={handleCloseRoleModal} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <form onSubmit={handleRoleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-1">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Role Name</label>
                                    <input 
                                        type="text" 
                                        value={roleFormData.name} 
                                        onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })} 
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm font-medium" 
                                        required 
                                        placeholder="e.g. Warehouse Supervisor" 
                                    />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                                    <input 
                                        type="text" 
                                        value={roleFormData.description} 
                                        onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })} 
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm" 
                                        placeholder="e.g. Manages inventory stock and dispatches" 
                                    />
                                </div>
                            </div>

                            {/* Permissions Header with Quick Toggles */}
                            <div className="pt-2">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                    <span className="text-sm font-bold text-gray-800">Module Permissions</span>
                                    <div className="flex space-x-2 text-xs">
                                        <button 
                                            type="button" 
                                            onClick={() => handleSelectAllPermissions(true)}
                                            className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 font-semibold"
                                        >
                                            Select All
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleSelectAllPermissions(false)}
                                            className="px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-semibold"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>

                                {/* Permissions Matrix */}
                                <div className="space-y-4 mt-3">
                                    {permissionCategories.map(cat => (
                                        <div key={cat.title} className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200">
                                            <div className="flex items-center space-x-2 mb-2 font-bold text-xs text-gray-700 uppercase tracking-wide">
                                                <span>{cat.icon}</span>
                                                <span>{cat.title}</span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {cat.items.map(item => {
                                                    const isChecked = roleFormData.permissions.includes(item.id) || roleFormData.permissions.includes('all');
                                                    return (
                                                        <label 
                                                            key={item.id} 
                                                            className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                                                isChecked 
                                                                    ? 'bg-indigo-50/60 border-indigo-200 text-indigo-900 font-semibold' 
                                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                                                            }`}
                                                        >
                                                            <input 
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleTogglePermission(item.id)}
                                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <span className="truncate">{item.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-4 border-t border-gray-100">
                                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-bold shadow-md">
                                    {editingRole ? 'Update Role' : 'Create Role'}
                                </button>
                                <button type="button" onClick={handleCloseRoleModal} className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition font-bold">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
