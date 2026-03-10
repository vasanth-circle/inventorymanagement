import { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Sidebar = () => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [expandedGroup, setExpandedGroup] = useState('inventory');

    const navGroups = [
        {
            name: 'Inventory',
            id: 'inventory',
            icon: '📦',
            items: [
                { name: 'Dashboard', path: '/dashboard', id: 'dashboard' },
                { name: 'Items', path: '/inventory', id: 'inventory' },
                { name: 'Categories', path: '/categories', id: 'categories' },
                { name: 'Bulk Import', path: '/bulk-import', id: 'bulk-import' },
                { name: 'Adjustments', path: '/stocks', id: 'stocks' },
            ]
        },
        {
            name: 'Sales',
            id: 'sales',
            icon: '🛒',
            items: [
                { name: 'Customers', path: '/customers', id: 'sales' },
                { name: 'Sales Orders', path: '/sales-orders', id: 'sales' },
            ]
        },
        {
            name: 'Purchases',
            id: 'purchases',
            icon: '🎫',
            items: [
                { name: 'Vendors', path: '/vendors', id: 'purchases' },
                { name: 'Purchase Orders', path: '/purchase-orders', id: 'purchases' },
                { name: 'Stock Inward', path: '/stock-inward', id: 'stock-inward' },
            ]
        },
        {
            name: 'Reports',
            id: 'reports',
            icon: '📈',
            items: [
                { name: 'All Reports', path: '/reports', id: 'reports' }
            ]
        }
    ];

    if (user?.role === 'admin' || user?.role === 'tenant_owner') {
        navGroups.push({
            name: 'Settings',
            id: 'settings',
            icon: '⚙️',
            items: [
                { name: 'Users', path: '/users', id: 'users' }
            ]
        });
    }

    const checkAccess = (itemId) => {
        if (user?.role === 'admin' || user?.menuAccess === 'all') return true;
        return user?.allowedMenus?.includes(itemId);
    };

    return (
        <aside className="w-64 bg-[#1a1f2e] text-slate-300 min-h-screen flex flex-col sticky top-0">
            <div className="p-6 border-b border-slate-700/50 flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white text-xl">📦</div>
                <h1 className="text-xl font-bold text-white tracking-tight">InventoryPro</h1>
            </div>

            <nav className="flex-1 mt-4 overflow-y-auto custom-scrollbar">
                {navGroups.map((group) => {
                    const accessibleItems = group.items.filter(item => checkAccess(item.id));
                    if (accessibleItems.length === 0) return null;

                    const isExpanded = expandedGroup === group.id;

                    return (
                        <div key={group.id} className="mb-2 px-3">
                            <button
                                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${isExpanded ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}
                            >
                                <div className="flex items-center">
                                    <span className="mr-3 text-lg opacity-80">{group.icon}</span>
                                    <span className="font-semibold text-sm tracking-wide">{group.name}</span>
                                </div>
                                <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                            </button>

                            {isExpanded && (
                                <div className="mt-1 ml-4 space-y-1">
                                    {accessibleItems.map((item) => {
                                        const isActive = location.pathname === item.path;
                                        return (
                                            <Link
                                                key={item.path}
                                                to={item.path}
                                                className={`flex items-center px-4 py-2 text-xs font-medium rounded-md transition-all ${isActive
                                                    ? 'bg-rose-600 text-white'
                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                                    }`}
                                            >
                                                {item.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <div className="p-4 bg-slate-800/30 border-t border-slate-700/50 flex items-center justify-between group">
                <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600 text-sm font-bold text-white flex-shrink-0">
                        {user?.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                        <Link to="/profile" className="text-[10px] text-slate-400 hover:text-white transition-colors uppercase font-bold tracking-tighter">View Profile</Link>
                    </div>
                </div>
                <button
                    onClick={() => {
                        logout();
                        navigate('/login');
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-700 rounded-lg transition-all"
                    title="Logout"
                >
                    🚪
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
