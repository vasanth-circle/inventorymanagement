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
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
            ),
            color: '#6366f1',
            items: [
                { name: 'Dashboard', path: '/dashboard', id: 'dashboard', icon: '◈' },
                { name: activePreset?.terminology?.items || 'Items', path: '/inventory', id: 'items', icon: '◈' },
                { name: 'HSN Codes', path: '/hsn-management', id: 'hsn', icon: '◈' },
                { name: 'Categories', path: '/categories', id: 'categories', icon: '◈' },
                { name: 'Brands', path: '/brands', id: 'brands', icon: '◈' },
                { name: 'Finishes', path: '/finishes', id: 'finishes', icon: '◈' },
                ...(billingSettings?.industry === 'tiles' ? [{ name: 'Manage Sizes', path: '/sizes', id: 'sizes', icon: '◈' }] : []),
                ...(billingSettings?.industry === 'machinery' ? [{ name: 'Parts Config', path: '/sizes', id: 'sizes', icon: '◈' }] : []),
                { name: 'Locations', path: '/locations', id: 'locations', icon: '◈' },
                { name: 'Bulk Import', path: '/bulk-import', id: 'bulk-import', icon: '◈' },
                { name: 'Stock Summary', path: '/stocks', id: 'stocks', icon: '◈' },
                { name: 'Stock Returns', path: '/stock-return', id: 'stock-return', icon: '◈' },
                { name: 'Returns List', path: '/stock-returns-list', id: 'stock-returns-list', icon: '◈' },
                { name: 'Make Adjustment', path: '/stock-adjustment', id: 'stock-adjustment', icon: '◈' },
            ]
        },
        {
            name: billingSettings?.industry === 'machinery' ? 'Sales & Work Orders' : 'Sales',
            id: 'sales',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
            ),
            color: '#0ea5e9',
            items: [
                { name: 'Parties', path: '/parties', id: 'parties', icon: '◈' },
                { name: 'Customer Types', path: '/customer-types', id: 'customer-types', icon: '◈' },
                { name: 'Quotations', path: '/quotations', id: 'quotations', icon: '◈' },
                { name: activePreset?.terminology?.salesOrder || 'Sales Orders', path: '/sales-orders', id: 'sales-orders', icon: '◈' },
                { name: activePreset?.terminology?.outward || 'Dispatch Management', path: '/dispatch-management', id: 'dispatch-management', icon: '◈' },
            ]
        },
        {
            name: billingSettings?.industry === 'machinery' ? 'Procurement' : 'Purchases',
            id: 'purchases',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
            ),
            color: '#10b981',
            items: [
                { name: activePreset?.terminology?.purchaseOrder || 'Purchase Entry', path: '/purchase-orders', id: 'purchase-orders', icon: '◈' },
                { name: 'Generate PO (Draft)', path: '/draft-pos', id: 'draft-pos', icon: '◈' },
                { name: activePreset?.terminology?.inward || 'Stock Inward', path: '/stock-inward', id: 'stock-inward', icon: '◈' },
            ]
        },
        {
            name: 'Reports & Accounts',
            id: 'reports',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
                </svg>
            ),
            color: '#f59e0b',
            items: [
                { name: 'Reports Hub', path: '/reports-hub', id: 'reports-hub', icon: '◈' }
            ]
        },
        {
            name: 'QR Showcase',
            id: 'qr-showcase',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
            ),
            color: '#8b5cf6',
            items: [
                { name: 'Manage Showcases', path: '/product-showcase', id: 'qr-showcase', icon: '◈' }
            ]
        }
    ];

        const isSettingsAllowed = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'tenant_owner' || user?.role === 'tenant_admin' || (user?.menuAccess === 'specific' && user?.allowedMenus?.includes('users'));

        if (isSettingsAllowed) {
            navGroups.push({
                name: 'Settings',
                id: 'settings',
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                ),
                color: '#6b7280',
                items: [
                    { name: 'Users', path: '/users', id: 'users', icon: '◈' },
                    { name: 'Billing Settings', path: '/settings', id: 'settings', icon: '◈' },
                    { name: 'Action Logs', path: '/action-logs', id: 'action-logs', icon: '◈' }
                ]
            });
        }
    } else if (activeApp === 'assets') {
        navGroups = [
            {
                name: 'Asset Dashboard',
                id: 'asset-dashboard',
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                ),
                color: '#6366f1',
                items: [
                    { name: 'Overview', path: '/assets/dashboard', id: 'asset-dashboard-overview', icon: '◈' }
                ]
            },
            {
                name: 'Assets',
                id: 'assets-main',
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                ),
                color: '#0ea5e9',
                items: [
                    { name: 'Manage Assets', path: '/assets', id: 'asset-manage', exact: true, icon: '◈' },
                    { name: 'Asset Reports', path: '/assets/reports', id: 'asset-reports', icon: '◈' },
                    { name: 'Maintenance Logs', path: '/assets/maintenance', id: 'asset-maintenance', icon: '◈' }
                ]
            }
        ];
        
        if (user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'tenant_owner' || user?.role === 'tenant_admin') {
            navGroups.push({
                name: 'Settings',
                id: 'settings',
                icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                ),
                color: '#6b7280',
                items: [
                    { name: 'Locations & Branches', path: '/locations', id: 'locations', icon: '◈' },
                    { name: 'Users', path: '/users', id: 'users', icon: '◈' },
                    { name: 'Action Logs', path: '/action-logs', id: 'action-logs', icon: '◈' }
                ]
            });
        }
    }

    const checkAccess = (itemId) => {
        const effectiveRole = user?.appRoles?.inventory || user?.role;

        if (user?.menuAccess === 'specific') {
            let isAllowed = user?.allowedMenus?.includes(itemId) || false;
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

    const roleLabel = user?.appRoles?.[activeApp] || user?.role?.replace(/_/g, ' ');
    const isDark = theme === 'dark';

    return (
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ background: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
                onClick={onClose}
            />

            <div className={`fixed inset-y-0 left-0 z-50 lg:static lg:flex lg:flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                style={{
                    width: '260px',
                    background: isDark ? '#0f172a' : '#ffffff',
                    borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                    boxShadow: isDark ? 'none' : '1px 0 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'background 0.2s ease, border-color 0.2s ease'
                }}
            >
                {/* Logo / App Switcher */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                        onClick={() => setShowAppSwitcher(!showAppSwitcher)}
                        style={{
                            width: '100%', height: '60px', display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', padding: '0 16px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f1f5f9',
                            transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {companyLogo ? (
                                <img src={companyLogo} alt="Logo" style={{ height: '30px', objectFit: 'contain' }} />
                            ) : (
                                <div style={{
                                    width: '34px', height: '34px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                                }}>
                                    <span style={{ color: 'white', fontWeight: 800, fontSize: '13px', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}>IM</span>
                                </div>
                            )}
                            <div style={{ textAlign: 'left' }}>
                                <span style={{
                                    color: isDark ? '#ffffff' : '#0f172a',
                                    fontWeight: 700, fontSize: '0.92rem',
                                    display: 'block', lineHeight: 1.2,
                                    fontFamily: 'Outfit, sans-serif'
                                }}>
                                    Vasanth
                                </span>
                                <span style={{
                                    fontSize: '0.66rem',
                                    fontWeight: 600,
                                    color: isDark ? '#818cf8' : '#4f46e5',
                                    background: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    display: 'inline-block',
                                    lineHeight: 1.3,
                                    marginTop: '2px'
                                }}>
                                    {activeApp === 'inventory' ? '● Inventory Suite' : '● Asset Suite'}
                                </span>
                            </div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8'} strokeWidth="2.5" style={{ transform: showAppSwitcher ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>

                    {/* Mobile close */}
                    <div
                        onClick={onClose}
                        style={{ position: 'absolute', top: '16px', right: '48px', padding: '6px', borderRadius: '8px', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b', display: 'flex' }}
                        className="lg:hidden"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>

                    {showAppSwitcher && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0,
                            background: isDark ? '#1e293b' : '#ffffff',
                            borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                            borderRight: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                            zIndex: 50,
                            boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.4)' : '0 12px 32px rgba(0,0,0,0.08)'
                        }}>
                            {[
                                { key: 'inventory', label: 'Inventory Suite', sub: 'Stock, Sales & Purchases', route: '/dashboard' },
                                { key: 'assets', label: 'Asset Suite', sub: 'Track company assets', route: '/assets/dashboard' }
                            ].map(app => (
                                <button key={app.key}
                                    onClick={() => { sessionStorage.setItem('activeApp', app.key); setShowAppSwitcher(false); window.location.href = app.route; }}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '12px 18px',
                                        background: activeApp === app.key
                                            ? (isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff')
                                            : 'none',
                                        border: 'none', cursor: 'pointer',
                                        borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f1f5f9',
                                        transition: 'background 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = activeApp === app.key ? (isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff') : (isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc')}
                                    onMouseLeave={e => e.currentTarget.style.background = activeApp === app.key ? (isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff') : 'none'}
                                >
                                    <div style={{ flex: 1, textAlign: 'left' }}>
                                        <span style={{
                                            display: 'block', fontWeight: 600, fontSize: '0.85rem',
                                            color: activeApp === app.key ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.85)' : '#0f172a'),
                                            fontFamily: 'Outfit, sans-serif'
                                        }}>
                                            {app.label}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: isDark ? 'rgba(255,255,255,0.35)' : '#64748b' }}>{app.sub}</span>
                                    </div>
                                    {activeApp === app.key && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Nav Items */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}
                    className="custom-scrollbar">
                    {navGroups.map((group) => {
                        const accessibleItems = group.items.filter(item => checkAccess(item.id));
                        if (accessibleItems.length === 0) return null;

                        const isGroupActive = accessibleItems.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
                        const isExpanded = expandedGroup !== null ? expandedGroup === group.id : isGroupActive;

                        return (
                            <div key={group.name} style={{ marginBottom: '2px' }}>
                                <button
                                    onClick={() => setExpandedGroup(isExpanded ? 'NONE' : group.id)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer',
                                        borderRadius: '8px', transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: group.color, opacity: 0.95, display: 'flex' }}>{group.icon}</span>
                                        <span style={{
                                            fontSize: '0.68rem', fontWeight: 700,
                                            color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b',
                                            textTransform: 'uppercase', letterSpacing: '0.08em',
                                            fontFamily: 'Outfit, sans-serif'
                                        }}>
                                            {group.name}
                                        </span>
                                    </span>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8'} strokeWidth="2.5"
                                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>

                                <div style={{
                                    overflow: 'hidden',
                                    maxHeight: isExpanded ? '1200px' : '0',
                                    opacity: isExpanded ? 1 : 0,
                                    transition: 'max-height 0.25s ease, opacity 0.2s ease',
                                    paddingLeft: '4px',
                                }}>
                                    {accessibleItems.map((item) => {
                                        const isActive = item.exact
                                            ? location.pathname === item.path
                                            : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                                        return (
                                            <Link
                                                key={item.name}
                                                to={item.path}
                                                onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '9px',
                                                    padding: '7px 11px', borderRadius: '8px',
                                                    margin: '1px 0', textDecoration: 'none',
                                                    fontSize: '0.82rem', fontWeight: isActive ? 600 : 500,
                                                    fontFamily: 'Inter, sans-serif',
                                                    color: isActive
                                                        ? (isDark ? '#ffffff' : '#4338ca')
                                                        : (isDark ? 'rgba(255,255,255,0.6)' : '#334155'),
                                                    background: isActive
                                                        ? (isDark
                                                            ? `linear-gradient(135deg, ${group.color}33, ${group.color}22)`
                                                            : '#eef2ff')
                                                        : 'transparent',
                                                    borderLeft: isActive
                                                        ? `3px solid ${isDark ? group.color : '#4f46e5'}`
                                                        : '3px solid transparent',
                                                    transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={e => {
                                                    if (!isActive) {
                                                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc';
                                                        e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.9)' : '#0f172a';
                                                    }
                                                }}
                                                onMouseLeave={e => {
                                                    if (!isActive) {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.6)' : '#334155';
                                                    }
                                                }}
                                            >
                                                <span style={{
                                                    width: '5px', height: '5px', borderRadius: '50%',
                                                    background: isActive ? (isDark ? group.color : '#4f46e5') : (isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1'),
                                                    flexShrink: 0,
                                                    boxShadow: isActive ? `0 0 6px ${isDark ? group.color : '#6366f1'}` : 'none',
                                                    transition: 'all 0.15s'
                                                }} />
                                                {item.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer User Profile Card */}
                <div style={{
                    flexShrink: 0, padding: '10px 14px',
                    borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f1f5f9',
                    background: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all 0.2s ease'
                }}>
                    <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', flex: 1, minWidth: 0 }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '12px', fontWeight: 700, fontFamily: 'Outfit, sans-serif',
                            boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                        }}>
                            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{
                                margin: 0, fontSize: '0.8rem', fontWeight: 600,
                                color: isDark ? 'rgba(255,255,255,0.9)' : '#0f172a',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                fontFamily: 'Outfit, sans-serif'
                            }}>
                                {user?.name}
                            </p>
                            <p style={{
                                margin: 0, fontSize: '0.66rem',
                                color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b',
                                textTransform: 'capitalize', fontFamily: 'Inter, sans-serif'
                            }}>
                                {roleLabel?.replace('_', ' ')}
                            </p>
                        </div>
                    </Link>

                    <button onClick={logout} title="Logout" style={{
                        flexShrink: 0, marginLeft: '6px', width: '30px', height: '30px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                        borderRadius: '8px', cursor: 'pointer',
                        color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b',
                        transition: 'all 0.15s',
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.borderColor = '#fecaca';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
                            e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.45)' : '#64748b';
                            e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
