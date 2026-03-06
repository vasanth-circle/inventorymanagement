import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
    ChartPieIcon,
    CubeIcon,
    TagIcon,
    UsersIcon,
    DocumentTextIcon,
    BuildingStorefrontIcon,
    ClipboardDocumentListIcon,
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    ArrowPathRoundedSquareIcon,
    DocumentArrowUpIcon,
    ClipboardDocumentIcon,
    ChartBarIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';

const Sidebar = () => {
    const { user } = useContext(AuthContext);
    const location = useLocation();

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: ChartPieIcon, id: 'dashboard' },
        { name: 'Inventory', path: '/inventory', icon: CubeIcon, id: 'inventory' },
        { name: 'Categories', path: '/categories', icon: TagIcon, id: 'categories' },
        { name: 'Customers', path: '/customers', icon: UsersIcon, id: 'sales' },
        { name: 'Sales Orders', path: '/sales-orders', icon: DocumentTextIcon, id: 'sales' },
        { name: 'Vendors', path: '/vendors', icon: BuildingStorefrontIcon, id: 'purchases' },
        { name: 'Purchase Orders', path: '/purchase-orders', icon: ClipboardDocumentListIcon, id: 'purchases' },
        { name: 'Stock Inward', path: '/stock-inward', icon: ArrowDownTrayIcon, id: 'stock-inward' },
        { name: 'Stock Outward', path: '/stock-outward', icon: ArrowUpTrayIcon, id: 'stock-outward' },
        { name: 'Stock Return', path: '/stock-return', icon: ArrowPathRoundedSquareIcon, id: 'stock-return' },
        { name: 'Bulk Import', path: '/bulk-import', icon: DocumentArrowUpIcon, id: 'bulk-import' },
        { name: 'Stocks', path: '/stocks', icon: ClipboardDocumentIcon, id: 'stocks' },
        { name: 'Reports', path: '/reports', icon: ChartBarIcon, id: 'reports' },
    ];

    const filteredNavItems = navItems.filter(item => {
        if (user?.role === 'admin') return true;
        if (user?.menuAccess === 'all') return true;
        return user?.allowedMenus?.includes(item.id);
    });

    const finalItems = [
        ...filteredNavItems,
        ...(user?.role === 'admin' ? [{ name: 'Users', path: '/users', icon: UserGroupIcon, id: 'users' }] : []),
    ];

    return (
        <aside className="w-64 bg-slate-900 text-slate-300 shadow-xl min-h-[calc(100vh-4rem)] relative z-40 flex flex-col">
            <div className="flex-1 overflow-y-auto px-3 py-6 hidden-scrollbar">
                <nav className="space-y-1">
                    <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Main Menu</p>
                    {finalItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${isActive
                                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <Icon className={`flex-shrink-0 mr-3 h-5 w-5 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`} aria-hidden="true" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Version / Info Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 shrink-0">
                <p className="text-xs text-slate-500 text-center">
                    InventoryPro &copy; {new Date().getFullYear()}
                </p>
            </div>

            {/* Add global css to hide scrollbar but keep functionality for sidebar */}
            <style jsx="true">{`
                .hidden-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hidden-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </aside>
    );
};

export default Sidebar;
