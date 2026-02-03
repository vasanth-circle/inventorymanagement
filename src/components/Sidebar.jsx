import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();

    const navItems = [
        { label: 'Dashboard', path: '/dashboard', icon: '📊' },
        { label: 'Inventory', path: '/inventory', icon: '📦' },
        { label: 'Stock Inward', path: '/stock-inward', icon: '📥' },
        { label: 'Stock Outward', path: '/stock-outward', icon: '📤' },
        { label: 'Stock Return', path: '/stock-return', icon: '🔄' },
        { label: 'Scan Bill', path: '/scan-bill', icon: '🧾' },
        { label: 'Returns', path: '/returns', icon: '↩️' },
        { label: 'Reports', path: '/reports', icon: '📈' },
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
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
