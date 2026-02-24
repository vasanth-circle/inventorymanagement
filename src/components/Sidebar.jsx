import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Sidebar = () => {
    const { user } = useContext(AuthContext);
    const location = useLocation();

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: '📊' },
        { name: 'Inventory', path: '/inventory', icon: '📦' },
        { name: 'Categories', path: '/categories', icon: '🏷️' },
        { name: 'Stock Inward', path: '/stock-inward', icon: '📥' },
        { name: 'Stock Outward', path: '/stock-outward', icon: '📤' },
        { name: 'Bulk Import', path: '/bulk-import', icon: '📁' },
        { name: 'Stocks', path: '/stocks', icon: '📋' },
        { name: 'Reports', path: '/reports', icon: '📈' },
        ...(user?.role === 'admin' ? [{ name: 'Users', path: '/users', icon: '👥' }] : []),
    ];

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
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
