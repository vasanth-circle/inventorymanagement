import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Users = () => {
    const { user: currentUser, fetchUsers, addUser, updateUserDetails, changeUserStatus, removeUser, confirmDelete } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({ 
        name: '', 
        email: '', 
        phone: '',
        password: '', 
        role: 'staff', 
        inventoryRole: 'inventory_user',
        isActive: true,
        menuAccess: 'all', 
        allowedMenus: [] 
    });
    
    const availableMenus = [
        { id: 'dashboard', name: 'Dashboard' },
        { id: 'inventory', name: 'Items & Stocks' },
        { id: 'categories', name: 'Categories' },
        { id: 'stock-inward', name: 'Stock Inward' },
        { id: 'stock-outward', name: 'Stock Outward' },
        { id: 'stock-return', name: 'Stock Return' },
        { id: 'stock-adjustment', name: 'Stock Adjustment' },
        { id: 'bulk-import', name: 'Bulk Import' },
        { id: 'stocks', name: 'Stocks Summary' },
        { id: 'reports', name: 'All Reports' },
        { id: 'customers', name: 'Customers' },
        { id: 'customer-ledger', name: 'Customer Ledgers' },
        { id: 'vendors', name: 'Vendors' },
        { id: 'vendor-ledger', name: 'Vendor Ledgers' },
        { id: 'quotations', name: 'Quotations' },
        { id: 'sales-orders', name: 'Sales Orders' },
        { id: 'purchase-orders', name: 'Purchase Orders' },
        { id: 'locations', name: 'Locations' },
        { id: 'dispatch-management', name: 'Dispatch' },
        { id: 'users', name: 'User Management' },
        { id: 'assets', name: 'Asset Management' },
    ];

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        const result = await fetchUsers();
        if (result.success) {
            setUsers(result.data);
        } else {
            toast.error(result.message);
        }
        setLoading(false);
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                password: '',
                role: user.role,
                inventoryRole: user.appRoles?.inventory || 'inventory_user',
                isActive: user.isActive !== undefined ? user.isActive : true,
                menuAccess: user.menuAccess || 'all',
                allowedMenus: user.allowedMenus || []
            });
        } else {
            setEditingUser(null);
            setFormData({ 
                name: '', 
                email: '', 
                phone: '',
                password: '', 
                role: 'staff', 
                inventoryRole: 'inventory_user',
                isActive: true,
                menuAccess: 'all', 
                allowedMenus: [] 
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let result;
        if (editingUser) {
            const { password, ...updateData } = formData;
            result = await updateUserDetails(editingUser._id, updateData);
        } else {
            result = await addUser(formData);
        }

        if (result.success) {
            toast.success(editingUser ? 'User updated successfully' : 'User added successfully');
            loadUsers();
            handleCloseModal();
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

    const handleDelete = async (id) => {
        if (id === currentUser._id) {
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center shadow-sm"
                >
                    <span className="mr-2">➕</span> Add User
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User Details</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">System Role</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inventory Role</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                    <div className="flex flex-col items-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                                        <span>Loading users...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : users.length > 0 ? (
                            users.map((u) => (
                                <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-900">{u.name}</span>
                                            <span className="text-xs text-gray-500">{u.email}</span>
                                            {u.phone && <span className="text-xs text-blue-600 font-medium mt-0.5">📞 {u.phone}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                            ['admin', 'super_admin', 'tenant_owner'].includes(u.role) ? 'bg-purple-100 text-purple-800' : 
                                            u.role === 'manager' ? 'bg-indigo-100 text-indigo-800' :
                                            u.role === 'sales_person' ? 'bg-orange-100 text-orange-800' :
                                            u.role === 'accounts' ? 'bg-emerald-100 text-emerald-800' :
                                            u.role === 'godown_staff' ? 'bg-amber-100 text-amber-800' :
                                            'bg-blue-100 text-blue-800'
                                        }`}>
                                            {u.role?.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                            u.appRoles?.inventory === 'inventory_admin' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {u.appRoles?.inventory?.replace('_', ' ') || 'No Access'}
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
                                        <button onClick={() => handleOpenModal(u)} className="text-primary-600 hover:text-primary-900 font-semibold">Edit</button>
                                        <button onClick={() => handleToggleStatus(u._id)} className={`font-semibold ${u.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}>
                                            {u.isActive ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button onClick={() => handleDelete(u._id)} className="text-red-600 hover:text-red-900 font-semibold">Delete</button>
                                    </td>
                                </tr>
                            ))
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

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingUser ? 'Edit User Permissions' : 'Add New User'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" required placeholder="John Doe" />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" required placeholder="john@example.com" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" placeholder="e.g. +91 98765 43210" />
                                </div>
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Initial Password</label>
                                    <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" required placeholder="Min 6 characters" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">System Role</label>
                                    <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all">
                                        <option value="admin">Admin</option>
                                        <option value="manager">Manager</option>
                                        <option value="sales_person">Sales Person</option>
                                        <option value="accounts">Accounts</option>
                                        <option value="godown_staff">Godown Staff</option>
                                        <option value="staff">Staff Member</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Inventory App Role</label>
                                    <select value={formData.inventoryRole} onChange={(e) => setFormData({ ...formData, inventoryRole: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all">
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
                                    checked={formData.isActive} 
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="isActive" className="text-sm font-semibold text-gray-700">User is Active and can Login</label>
                            </div>

                            <div className="pt-2 border-t border-gray-100">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Navigation Permissions</label>
                                <div className="flex space-x-4 mb-3">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name="menuAccess" checked={formData.menuAccess === 'all'} onChange={() => setFormData({ ...formData, menuAccess: 'all' })} className="text-primary-600 focus:ring-primary-500" />
                                        <span className="text-sm">Full Access</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name="menuAccess" checked={formData.menuAccess === 'specific'} onChange={() => setFormData({ ...formData, menuAccess: 'specific' })} className="text-primary-600 focus:ring-primary-500" />
                                        <span className="text-sm">Custom Access</span>
                                    </label>
                                </div>

                                {formData.menuAccess === 'specific' && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                            {availableMenus.map(menu => (
                                                <label key={menu.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.allowedMenus.includes(menu.id)}
                                                        onChange={(e) => {
                                                            const newMenus = e.target.checked
                                                                ? [...formData.allowedMenus, menu.id]
                                                                : formData.allowedMenus.filter(id => id !== menu.id);
                                                            setFormData({ ...formData, allowedMenus: newMenus });
                                                        }}
                                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span className="text-gray-600">{menu.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex space-x-3 pt-4 border-t border-gray-100">
                                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold shadow-md">
                                    {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-bold">
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
