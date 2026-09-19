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
                    { name: 'Overview', path: '/assets/dashboard', id: 'asset-dashboard-overview' }
                ]
            },
            {
                name: 'Assets',
                id: 'assets-main',
                icon: '🖥️',
                items: [
                    { name: 'Manage Assets', path: '/assets', id: 'asset-manage', exact: true },
                    { name: 'Asset Reports', path: '/assets/reports', id: 'asset-reports' },
                    { name: 'Maintenance Logs', path: '/assets/maintenance', id: 'asset-maintenance' }
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
                
                {/* Header / Logo — also serves as App Switcher toggle */}
                <div className="relative shrink-0">
                    <button
                        onClick={() => setShowAppSwitcher(!showAppSwitcher)}
                        className="w-full h-16 flex items-center justify-between px-5 border-b border-gray-100/80 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            {companyLogo ? (
                                <img src={companyLogo} alt="Logo" className="h-8 object-contain" />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                                    <span className="text-white font-bold text-sm tracking-tighter">IM</span>
                                </div>
                            )}
                            <div className="text-left">
                                <span className="text-base font-bold text-gray-900 tracking-tight block leading-tight">Vasanth</span>
                                <span className="text-[11px] font-semibold text-primary-600 block leading-none">
                                    {activeApp === 'inventory' ? '📦 Inventory Suite' : '🖥️ Asset Suite'}
                                </span>
                            </div>
                        </div>
                        <span className={`text-gray-400 text-[10px] transition-transform duration-200 ${showAppSwitcher ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {/* Mobile close button — separate from the toggle button to avoid nesting */}
                    <div
                        onClick={onClose}
                        className="absolute top-4 right-12 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden transition-colors cursor-pointer"
                    >
                        <span className="text-lg leading-none">&times;</span>
                    </div>

                    {showAppSwitcher && (
                        <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-100 shadow-md z-50">
                            <button
                                onClick={() => {
                                    sessionStorage.setItem('activeApp', 'inventory');
                                    setShowAppSwitcher(false);
                                    window.location.href = '/dashboard';
                                }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-sm border-b border-gray-50 ${activeApp === 'inventory' ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <span>📦</span>
                                <div className="text-left">
                                    <span className="block font-semibold">Inventory Suite</span>
                                    <span className="text-[10px] text-gray-400">Stock, Sales & Purchases</span>
                                </div>
                                {activeApp === 'inventory' && <span className="ml-auto text-primary-600 text-xs font-black">✓</span>}
                            </button>
                            <button
                                onClick={() => {
                                    sessionStorage.setItem('activeApp', 'assets');
                                    setShowAppSwitcher(false);
                                    window.location.href = '/assets/dashboard';
                                }}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-sm ${activeApp === 'assets' ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <span>🖥️</span>
                                <div className="text-left">
                                    <span className="block font-semibold">Asset Suite</span>
                                    <span className="text-[10px] text-gray-400">Track company assets</span>
                                </div>
                                {activeApp === 'assets' && <span className="ml-auto text-primary-600 text-xs font-black">✓</span>}
                            </button>
                        </div>
                    )}
                </div>


                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-4 px-3 space-y-6">
                    {navGroups.map((group) => {
                        const accessibleItems = group.items.filter(item => checkAccess(item.id));
                        if (accessibleItems.length === 0) return null;

                        const isGroupActive = accessibleItems.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
                        const isExpanded = expandedGroup !== null ? expandedGroup === group.id : isGroupActive;

                        return (
                            <div key={group.name} className="px-1">
                                <button
                                    onClick={() => setExpandedGroup(isExpanded ? 'NONE' : group.id)}
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
                                        const isActive = item.exact
                                            ? location.pathname === item.path
                                            : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
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
                <div className="shrink-0 p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <Link to="/profile" className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity flex-1" title="Go to Profile">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-primary-400 flex items-center justify-center text-white text-sm font-bold shadow-inner shrink-0">
                            {user?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate leading-tight">{user?.name}</p>
                            <p className="text-[10px] text-gray-500 truncate capitalize leading-tight">{user?.appRoles?.[activeApp] || user?.role?.replace('_', ' ')}</p>
                        </div>
                    </Link>
                    
                    <button onClick={logout} className="shrink-0 ml-2 w-8 h-8 flex items-center justify-center text-gray-400 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors" title="Logout">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>

            </div>
        </>
    );
};

export default Sidebar;
