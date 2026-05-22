import { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { InventoryContext } from '../context/InventoryContext';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout, activeBranchId, setActiveBranch } = useContext(AuthContext);
    const { activePreset, billingSettings, branches } = useContext(InventoryContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [expandedGroup, setExpandedGroup] = useState(null);
    const [showAppSwitcher, setShowAppSwitcher] = useState(false);
    const [showBranchMenu, setShowBranchMenu] = useState(false);

    const isAdmin = !user?.branchIds?.length; // empty branchIds = admin/all-access
    const viewableBranches = isAdmin ? branches : branches.filter(b => user?.branchIds?.some(id => id === b._id || id?.toString() === b._id?.toString()));
    const activeBranch = branches.find(b => b._id === activeBranchId);

    const activeApp = localStorage.getItem('activeApp') || 'inventory';
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
                ...(billingSettings?.industry === 'tiles' ? [{ name: 'Manage Sizes', path: '/sizes', id: 'sizes' }] : []),
                { name: 'Locations', path: '/locations', id: 'locations' },
                { name: 'Bulk Import', path: '/bulk-import', id: 'bulk-import' },
                { name: 'Stock Summary', path: '/stocks', id: 'stocks' },
                { name: 'Stock Returns', path: '/stock-return', id: 'stock-return' },
                { name: 'Make Adjustment', path: '/stock-adjustment', id: 'stock-adjustment' },
            ]
        },
        {
            name: 'Sales',
            id: 'sales',
            icon: '🛒',
            items: [
                { name: activePreset?.terminology?.customers || 'Customers', path: '/customers', id: 'customers' },
                { name: 'Customer Ledgers', path: '/customer-ledger', id: 'customer-ledger' },
                { name: 'Quotations', path: '/quotations', id: 'quotations' },
                { name: 'Sales Orders', path: '/sales-orders', id: 'sales-orders' },
                { name: activePreset?.terminology?.outward || 'Dispatch Management', path: '/dispatch-management', id: 'dispatch-management' },
            ]
        },
        {
            name: 'Purchases',
            id: 'purchases',
            icon: '🎫',
            items: [
                { name: 'Vendors', path: '/vendors', id: 'vendors' },
                { name: 'Vendor Ledgers', path: '/vendor-ledger', id: 'vendor-ledger' },
                { name: 'Purchase Orders', path: '/purchase-orders', id: 'purchase-orders' },
                { name: activePreset?.terminology?.inward || 'Stock Inward', path: '/stock-inward', id: 'stock-inward' },
            ]
        },
        {
            name: 'Reports',
            id: 'reports',
            icon: '📈',
            items: [
                { name: 'Analytics Dashboard', path: '/reports', id: 'reports' },
                { name: 'Financial Ledgers', path: '/ledger-reports', id: 'ledger-reports' }
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

        if (user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'tenant_owner' || user?.role === 'tenant_admin') {
            navGroups.push({
                name: 'Settings',
                id: 'settings',
                icon: '⚙️',
                items: [
                    { name: 'Branches', path: '/branches', id: 'branches' },
                    { name: 'Branch Transfer', path: '/branch-transfer', id: 'branch-transfer' },
                    { name: 'Users', path: '/users', id: 'users' },
                    { name: 'Billing Settings', path: '/settings', id: 'settings' }
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
                    { name: 'Users', path: '/users', id: 'users' }
                ]
            });
        }
    }

    const checkAccess = (itemId) => {
        const effectiveRole = user?.appRoles?.inventory || user?.role;

        // 1. Apply restrictive roles first (Top Priority)
        if (effectiveRole === 'sales_person' || effectiveRole === 'sales person' || effectiveRole === 'sales user' || effectiveRole === 'sales_user') {
            const salesAllowed = ['dashboard', 'items', 'stocks', 'quotations', 'sales-orders', 'dispatch-management', 'customers', 'customer-ledger'];
            return salesAllowed.includes(itemId);
        }

        if (effectiveRole === 'accounts') {
            const accountsAllowed = ['dashboard', 'items', 'customers', 'vendors', 'customer-ledger', 'vendor-ledger', 'reports', 'ledger-reports'];
            return accountsAllowed.includes(itemId);
        }

        if (effectiveRole === 'godown_staff' || effectiveRole === 'godown staff') {
            const godownAllowed = ['dashboard', 'items', 'stocks', 'dispatch-management', 'stock-adjustment', 'stock-return'];
            return godownAllowed.includes(itemId);
        }

        // 2. Full Access overrides (If no restrictive app role is set)
        if (user?.menuAccess === 'all') return true;
        if (effectiveRole === 'admin' || effectiveRole === 'manager' || effectiveRole === 'inventory_admin' || user?.role === 'admin' || user?.role === 'manager') {
            return true;
        }

        // 3. Specific menu access check
        if (user?.menuAccess === 'specific' && user?.allowedMenus?.includes(itemId)) {
            return true;
        }

        return false;
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
                    onClick={onClose}
                />
            )}

            <aside className={`
                w-64 bg-[#1a1f2e] text-slate-300 h-screen flex flex-col fixed inset-y-0 left-0 z-50 
                transform transition-transform duration-300 ease-in-out
                lg:relative lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                print:hidden
            `}>
                <div className="p-4 lg:p-6 border-b border-slate-700/50 flex flex-col gap-3 overflow-visible relative">
                    <div className="flex items-center justify-end lg:hidden">
                        {/* Close button for mobile */}
                        <button 
                            onClick={onClose}
                            className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="relative">
                        <div
                            className="flex items-center space-x-3 cursor-pointer hover:bg-slate-800 p-2 -ml-2 rounded-lg transition-colors group"
                            onClick={() => setShowAppSwitcher(!showAppSwitcher)}
                        >
                            <div className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center text-white text-xl shadow-inner overflow-hidden ${activeApp === 'assets' ? 'bg-blue-600' : 'bg-primary-600'}`}>
                                {activeApp === 'assets' ? '🖥️' : '📦'}
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <h1 className="text-base lg:text-lg font-bold text-white tracking-tight leading-none group-hover:text-blue-400 transition-colors truncate">
                                    {activeApp === 'assets' ? 'Asset Management' : 'InventoryPro'}
                                </h1>
                                <span className="text-[10px] text-slate-400 font-semibold tracking-wide flex items-center mt-0.5">
                                    CHANGE APP <span className="ml-1 opacity-50 text-[8px]">▼</span>
                                </span>
                            </div>
                        </div>

                        {showAppSwitcher && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowAppSwitcher(false)}></div>
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50">Switch Application</div>
                                    
                                    <button 
                                        onClick={() => {
                                            localStorage.setItem('activeApp', 'inventory');
                                            window.location.href = '/dashboard';
                                        }}
                                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 transition-colors ${activeApp === 'inventory' ? 'bg-primary-50' : ''}`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${activeApp === 'inventory' ? 'bg-primary-100' : 'bg-gray-100'}`}>📦</div>
                                        <div>
                                            <div className={`text-sm font-bold ${activeApp === 'inventory' ? 'text-primary-700' : 'text-gray-900'}`}>InventoryPro</div>
                                            <div className="text-xs text-gray-500">Manage Stocks & Sales</div>
                                        </div>
                                    </button>

                                    <button 
                                        onClick={() => {
                                            localStorage.setItem('activeApp', 'assets');
                                            window.location.href = '/assets/dashboard';
                                        }}
                                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 border-t border-gray-100 transition-colors ${activeApp === 'assets' ? 'bg-blue-50' : ''}`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${activeApp === 'assets' ? 'bg-blue-100' : 'bg-gray-100'}`}>🖥️</div>
                                        <div>
                                            <div className={`text-sm font-bold ${activeApp === 'assets' ? 'text-blue-700' : 'text-gray-900'}`}>Asset Management</div>
                                            <div className="text-xs text-gray-500">Manage Hardware & Vehicles</div>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}

                    </div>

                    {/* Branch Selector — visible to all users with branches */}
                    {viewableBranches.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setShowBranchMenu(!showBranchMenu)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-300 transition-colors"
                            >
                                <span>{activeBranch?.isHeadOffice ? '🏛️' : '🏪'}</span>
                                <span className="flex-1 text-left truncate font-medium">
                                    {activeBranch?.name || (isAdmin ? 'All Branches' : viewableBranches[0]?.name)}
                                </span>
                                {activeBranch && (
                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">{activeBranch.code}</span>
                                )}
                                <span className="opacity-50 text-[8px]">▼</span>
                            </button>

                            {showBranchMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowBranchMenu(false)} />
                                    <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-2xl border border-gray-100 z-50 py-1 overflow-hidden">
                                        <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">View Branch</div>
                                        {isAdmin && (
                                            <button
                                                onClick={() => { setActiveBranch(null); setShowBranchMenu(false); }}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${!activeBranchId ? 'text-primary-600 font-semibold bg-primary-50' : 'text-gray-700'}`}
                                            >
                                                <span>🏢</span> All Branches
                                                {!activeBranchId && <span className="ml-auto text-primary-500 text-xs">●</span>}
                                            </button>
                                        )}
                                        {viewableBranches.map(b => (
                                            <button
                                                key={b._id}
                                                onClick={() => { setActiveBranch(b._id); setShowBranchMenu(false); }}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50 ${activeBranchId === b._id ? 'text-primary-600 font-semibold bg-primary-50' : 'text-gray-700'}`}
                                            >
                                                <span>{b.isHeadOffice ? '🏛️' : '🏪'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm leading-none truncate">{b.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">{b.code}</div>
                                                </div>
                                                {activeBranchId === b._id && <span className="text-primary-500 text-xs">●</span>}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
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
                                                onClick={() => {
                                                    if (window.innerWidth < 1024) onClose();
                                                }}
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
                    onClick={toggleTheme}
                    className="p-1.5 mr-2 text-slate-400 hover:text-yellow-400 hover:bg-slate-700 rounded-lg transition-all"
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
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
        </>
    );
};

export default Sidebar;
