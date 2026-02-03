import { Link, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const Sidebar = () => {
    const location = useLocation();
    const { user, hasMenuAccess } = useContext(AuthContext);

    const allNavItems = [
        { label: 'Dashboard', path: '/dashboard', icon: '📊', id: 'dashboard' },
        { label: 'Inventory', path: '/inventory', icon: '📦', id: 'inventory' },
        { label: 'Stock Inward', path: '/stock-inward', icon: '📥', id: 'stock-inward' },
        { label: 'Stock Outward', path: '/stock-outward', icon: '📤', id: 'stock-outward' },
        { label: 'Stock Return', path: '/stock-return', icon: '🔄', id: 'stock-return' },
        { label: 'Scan Bill', path: '/scan-bill', icon: '🧾', id: 'scan-bill' },
        { label: 'Returns', path: '/returns', icon: '↩️', id: 'returns' },
        { label: 'Reports', path: '/reports', icon: '📈', id: 'reports' },
    ];

    // Filter menu items based on user permissions
    const navItems = allNavItems.filter(item => hasMenuAccess(item.id));

    // Add Users menu item for admin only
    if (user?.role === 'admin') {
        navItems.push({ label: 'Users', path: '/users', icon: '👥', id: 'users' });
    }

    return (
        <aside className="w-64 bg-white shadow-md min-h-screen">
            <nav className="mt-5 px-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`group flex items-center px-4 py-3 text-sm font-medium rounded-md mb-1 transition-colors ${isActive
                                ? 'bg-primary-100 text-primary-700'
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                        >
                            <span className="mr-3 text-xl">{item.icon}</span>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
