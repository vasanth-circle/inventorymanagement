import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Sidebar = () => {
    const { user } = useContext(AuthContext);
    const location = useLocation();

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: '📊', id: 'dashboard' },
        { name: 'Inventory', path: '/inventory', icon: '📦', id: 'inventory' },
        { name: 'Categories', path: '/categories', icon: '🏷️', id: 'categories' },
        { name: 'Customers', path: '/customers', icon: '👥', id: 'sales' },
        { name: 'Sales Orders', path: '/sales-orders', icon: '📝', id: 'sales' },
        { name: 'Vendors', path: '/vendors', icon: '🏪', id: 'purchases' },
        { name: 'Purchase Orders', path: '/purchase-orders', icon: '📋', id: 'purchases' },
        { name: 'Stock Inward', path: '/stock-inward', icon: '📥', id: 'stock-inward' },
        { name: 'Stock Outward', path: '/stock-outward', icon: '📤', id: 'stock-outward' },
        { name: 'Stock Return', path: '/stock-return', icon: '↩️', id: 'stock-return' },
        { name: 'Bulk Import', path: '/bulk-import', icon: '📁', id: 'bulk-import' },
        { name: 'Stocks', path: '/stocks', icon: '📋', id: 'stocks' },
        { name: 'Reports', path: '/reports', icon: '📈', id: 'reports' },
    ];

    const filteredNavItems = navItems.filter(item => {
        if (user?.role === 'admin') return true;
        if (user?.menuAccess === 'all') return true;
        return user?.allowedMenus?.includes(item.id);
    });

    const finalItems = [
        ...filteredNavItems,
        ...(user?.role === 'admin' ? [{ name: 'Users', path: '/users', icon: '👥', id: 'users' }] : []),
    ];

    return (
        <aside className="w-64 bg-white shadow-md min-h-screen">
            <nav className="mt-5 px-2">
                {finalItems.map((item) => {
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
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
