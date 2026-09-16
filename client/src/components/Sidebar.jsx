import { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { InventoryContext } from '../context/InventoryContext';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout } = useContext(AuthContext);
    const { activePreset, billingSettings } = useContext(InventoryContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [expandedGroup, setExpandedGroup] = useState(null);
    const [showAppSwitcher, setShowAppSwitcher] = useState(false);

    const activeApp = sessionStorage.getItem('activeApp') || 'inventory';
    const companyLogo = billingSettings?.branding?.logoUrl;

    let navGroups = [];

    if (activeApp === 'inventory') {
        navGroups = [
        {
            name: 'Inventory',
            id: 'inventory',
            icon: '📦',
            items: [
                { name: 'Dashboard', path: '/dashboard', id: 'dashboard' },
                { name: activePreset?.terminology?.items || 'Items', path: '/inventory', id: 'items' },
                { name: 'HSN Codes', path: '/hsn-management', id: 'hsn' },
                { name: 'Categories', path: '/categories', id: 'categories' },
                { name: 'Brands', path: '/brands', id: 'brands' },
                { name: 'Finishes', path: '/finishes', id: 'finishes' },
                ...(billingSettings?.industry === 'tiles' ? [{ name: 'Manage Sizes', path: '/sizes', id: 'sizes' }] : []),
                ...(billingSettings?.industry === 'machinery' ? [{ name: 'Parts Config', path: '/sizes', id: 'sizes' }] : []),
                { name: 'Locations', path: '/locations', id: 'locations' },
                { name: 'Bulk Import', path: '/bulk-import', id: 'bulk-import' },
                { name: 'Stock Summary', path: '/stocks', id: 'stocks' },
                { name: 'Stock Returns', path: '/stock-return', id: 'stock-return' },
                { name: 'Stock Returns List', path: '/stock-returns-list', id: 'stock-returns-list' },
                { name: 'Make Adjustment', path: '/stock-adjustment', id: 'stock-adjustment' },
            ]
        },
        {
            name: billingSettings?.industry === 'machinery' ? 'Sales & Work Orders' : 'Sales',
            id: 'sales',
            icon: billingSettings?.industry === 'machinery' ? '🏭' : '🛒',
            items: [
                { name: 'Parties', path: '/parties', id: 'parties' },
                { name: 'Customer Types', path: '/customer-types', id: 'customer-types' },

                { name: 'Quotations', path: '/quotations', id: 'quotations' },
                { name: activePreset?.terminology?.salesOrder || 'Sales Orders', path: '/sales-orders', id: 'sales-orders' },
                { name: activePreset?.terminology?.outward || 'Dispatch Management', path: '/dispatch-management', id: 'dispatch-management' },
            ]
        },
        {
            name: billingSettings?.industry === 'machinery' ? 'Procurement' : 'Purchases',
            id: 'purchases',
            icon: billingSettings?.industry === 'machinery' ? '🔩' : '🎫',
            items: [
                { name: activePreset?.terminology?.purchaseOrder || 'Purchase Entry', path: '/purchase-orders', id: 'purchase-orders' },
                { name: 'Generate PO (Draft)', path: '/draft-pos', id: 'draft-pos' },
                { name: activePreset?.terminology?.inward || 'Stock Inward', path: '/stock-inward', id: 'stock-inward' },
            ]
        },
        {
            name: 'Reports & Accounts',
            id: 'reports',
            icon: '📈',
            items: [
                { name: 'Reports Hub', path: '/reports-hub', id: 'reports-hub' }
            ]
        },
        {
            name: 'QR Showcase',
            id: 'qr-showcase',
            icon: '📱',
            items: [
                { name: 'Manage Showcases', path: '/product-showcase', id: 'qr-showcase' }
            ]
        }
    ];

        const isSettingsAllowed = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'tenant_owner' || user?.role === 'tenant_admin' || (user?.menuAccess === 'specific' && user?.allowedMenus?.includes('users'));

        if (isSettingsAllowed) {
            navGroups.push({
                name: 'Settings',
                id: 'settings',
                icon: '⚙️',
                items: [
                    { name: 'Users', path: '/users', id: 'users' },
                    { name: 'Billing Settings', path: '/settings', id: 'settings' },
                    { name: 'Action Logs', path: '/action-logs', id: 'action-logs' }
                ]
            });
        }
    } else if (activeApp === 'assets') {
        navGroups = [
            {
                name: 'Asset Dashboard',
                id: 'asset-dashboard',
                icon: '📊',
                items: [
                    { name: 'Overview', path: '/assets/dashboard', id: 'assets' }
                ]
            },
            {
                name: 'Assets',
                id: 'assets-main',
                icon: '🖥️',
                items: [
                    { name: 'Manage Assets', path: '/assets', id: 'assets' },
                    { name: 'Asset Reports', path: '/assets/reports', id: 'assets' }
                ]
            }
        ];
        
        if (user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'tenant_owner' || user?.role === 'tenant_admin') {
            navGroups.push({
                name: 'Settings',
                id: 'settings',
                icon: '⚙️',
                items: [
                    { name: 'Locations & Branches', path: '/locations', id: 'locations' },
                    { name: 'Users', path: '/users', id: 'users' },
                    { name: 'Action Logs', path: '/action-logs', id: 'action-logs' }
                ]
            });
        }
    }

    const checkAccess = (itemId) => {
        const effectiveRole = user?.appRoles?.inventory || user?.role;

        // 1. Specific menu access check (Highest Priority)
        if (user?.menuAccess === 'specific') {
            let isAllowed = user?.allowedMenus?.includes(itemId) || false;
            
            // Handle aliases between Users.jsx options and Sidebar.jsx ids
            if (!isAllowed) {
                if (itemId === 'items' && user?.allowedMenus?.includes('inventory')) isAllowed = true;
                if (itemId === 'dispatch-management' && user?.allowedMenus?.includes('stock-outward')) isAllowed = true;
                if (itemId === 'purchase-orders' && user?.allowedMenus?.includes('purchases')) isAllowed = true;
                if (itemId === 'stock-inward' && user?.allowedMenus?.includes('purchases')) isAllowed = true;
                if (itemId === 'parties' && (user?.allowedMenus?.includes('customers') || user?.allowedMenus?.includes('vendors'))) isAllowed = true;
                if (itemId === 'reports-hub' && user?.allowedMenus?.includes('reports')) isAllowed = true;
            }
            return isAllowed;
        }

        // 2. Role-based defaults (if not using specific menus)
        if (effectiveRole === 'super_admin' || effectiveRole === 'admin' || effectiveRole === 'tenant_owner' || effectiveRole === 'tenant_admin') {
            return true;
        }

        if (effectiveRole === 'sales_manager') {
            const allowed = ['dashboard', 'items', 'categories', 'stocks', 'customers', 'sales-orders', 'quotations', 'dispatch-management', 'reports-hub', 'ledger'];
            return allowed.includes(itemId);
        }

        if (effectiveRole === 'inventory_manager') {
            const allowed = ['dashboard', 'items', 'categories', 'locations', 'stocks', 'bulk-import', 'stock-adjustment', 'vendors', 'purchase-orders', 'stock-inward', 'stock-return', 'stock-returns-list'];
            return allowed.includes(itemId);
        }

        if (effectiveRole === 'staff') {
            const allowed = ['dashboard', 'items', 'stocks', 'customers', 'sales-orders'];
            return allowed.includes(itemId);
        }

        return false;
    };

    return (
        <>
            <div className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />

            <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 shadow-xl lg:shadow-none lg:static lg:flex lg:flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                
                {/* Header / Logo */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100/80 shrink-0">
                    <div className="flex items-center gap-3">
                        {companyLogo ? (
                            <img src={companyLogo} alt="Logo" className="h-8 object-contain" />
                        ) : (
                            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm tracking-tighter">IM</span>
                            </div>
                        )}
                        <div>
                            <span className="text-lg font-bold text-gray-900 tracking-tight">Vasanth</span>
                            <span className="text-xs font-semibold text-primary-600 block leading-none">Enterprise</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden transition-colors">
                        <span className="text-xl leading-none">&times;</span>
                    </button>
                </div>

                {/* App Switcher */}
                <div className="relative p-4 border-b border-gray-100 shrink-0">
                    <button 
                        onClick={() => setShowAppSwitcher(!showAppSwitcher)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/50"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">{activeApp === 'inventory' ? '📦' : '🖥️'}</span>
                            <div className="text-left">
                                <span className="block text-sm font-semibold text-gray-900 capitalize">{activeApp} Suite</span>
                                <span className="block text-xs text-gray-500">Switch Application</span>
                            </div>
                        </div>
                        <span className="text-gray-400">▼</span>
                    </button>

                    {showAppSwitcher && (
                        <div className="absolute top-full left-4 right-4 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                            <button 
                                onClick={() => {
                                    sessionStorage.setItem('activeApp', 'inventory');
                                    setShowAppSwitcher(false);
                                    window.location.href = '/dashboard';
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${activeApp === 'inventory' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <span className="text-lg">📦</span> Inventory Suite
                            </button>
                            <button 
                                onClick={() => {
                                    sessionStorage.setItem('activeApp', 'assets');
                                    setShowAppSwitcher(false);
                                    window.location.href = '/assets/dashboard';
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${activeApp === 'assets' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <span className="text-lg">🖥️</span> Asset Suite
                            </button>
                        </div>
                    )}
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-4 px-3 space-y-6">
                    {navGroups.map((group) => {
                        const accessibleItems = group.items.filter(item => checkAccess(item.id));
                        if (accessibleItems.length === 0) return null;

                        const isGroupActive = accessibleItems.some(item => location.pathname.startsWith(item.path));
                        const isExpanded = expandedGroup === group.id || isGroupActive;

                        return (
                            <div key={group.name} className="px-1">
                                <button
                                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <span>{group.icon}</span>
                                        {group.name}
                                    </span>
                                    <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                </button>
                                
                                <div className={`mt-2 space-y-1 transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'opacity-100 max-h-[2000px] translate-y-0' : 'opacity-0 max-h-0 -translate-y-2'}`}>
                                    {accessibleItems.map((item) => {
                                        const isActive = location.pathname.startsWith(item.path);
                                        return (
                                            <Link
                                                key={item.name}
                                                to={item.path}
                                                onClick={() => {
                                                    if (window.innerWidth < 1024) onClose();
                                                }}
                                                className={`group flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                                    isActive 
                                                        ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20' 
                                                        : 'text-gray-600 hover:bg-primary-50 hover:text-primary-700'
                                                }`}
                                            >
                                                {isActive && (
                                                    <span className="absolute left-0 w-1 h-8 bg-primary-600 rounded-r-md" />
                                                )}
                                                <span className="relative z-10">{item.name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer User Profile */}
                <div className="shrink-0 p-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3 px-2 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-600 to-primary-400 flex items-center justify-center text-white font-bold shadow-inner">
                            {user?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                            <p className="text-xs text-gray-500 truncate capitalize">{user?.appRoles?.[activeApp] || user?.role?.replace('_', ' ')}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <Link to="/profile" className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-primary-600 transition-colors">
                            👤 Profile
                        </Link>
                        <button onClick={logout} className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-600 bg-white border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                            🚪 Logout
                        </button>
                    </div>
                </div>

            </div>
        </>
    );
};

export default Sidebar;
