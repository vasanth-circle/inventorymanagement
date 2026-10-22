import { useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';
import { ThemeContext } from '../context/ThemeContext';
import {
    Bars3Icon,
    MagnifyingGlassIcon,
    SunIcon,
    MoonIcon,
    PlusIcon,
    ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

const PAGE_TITLES = {
    '/dashboard': { title: 'Dashboard', section: 'Overview', icon: '📊' },
    '/inventory': { title: 'Inventory & Items', section: 'Inventory', icon: '📦' },
    '/hsn-management': { title: 'HSN Codes', section: 'Inventory', icon: '🏷️' },
    '/categories': { title: 'Categories', section: 'Inventory', icon: '🗂️' },
    '/brands': { title: 'Brands Master', section: 'Inventory', icon: '🏷️' },
    '/finishes': { title: 'Finishes Master', section: 'Inventory', icon: '✨' },
    '/sizes': { title: 'Size Management', section: 'Inventory', icon: '📐' },
    '/locations': { title: 'Locations & Warehouses', section: 'Inventory', icon: '🏢' },
    '/bulk-import': { title: 'Bulk Import', section: 'Inventory', icon: '📥' },
    '/stocks': { title: 'Stock Summary', section: 'Inventory', icon: '📋' },
    '/stock-return': { title: 'Stock Returns', section: 'Inventory', icon: '↩️' },
    '/stock-returns-list': { title: 'Returns List', section: 'Inventory', icon: '📝' },
    '/stock-adjustment': { title: 'Stock Adjustment', section: 'Inventory', icon: '⚖️' },
    '/parties': { title: 'Parties & Directory', section: 'Sales', icon: '👥' },
    '/customer-types': { title: 'Customer Types', section: 'Sales', icon: '🏷️' },
    '/quotations': { title: 'Quotations', section: 'Sales', icon: '📄' },
    '/sales-orders': { title: 'Sales Orders', section: 'Sales', icon: '🛒' },
    '/dispatch-management': { title: 'Dispatch Management', section: 'Sales', icon: '🚚' },
    '/purchase-orders': { title: 'Purchase Entry', section: 'Purchases', icon: '🎫' },
    '/draft-pos': { title: 'Draft Purchase Orders', section: 'Purchases', icon: '📝' },
    '/stock-inward': { title: 'Stock Inward', section: 'Purchases', icon: '📥' },
    '/reports-hub': { title: 'Reports Hub', section: 'Reports', icon: '📈' },
    '/reports': { title: 'Analytics Reports', section: 'Reports', icon: '📊' },
    '/profit': { title: 'Profit Tracking', section: 'Accounts', icon: '💰' },
    '/expenses': { title: 'Expenses & Overhead', section: 'Accounts', icon: '💸' },
    '/settings': { title: 'Settings & Billing', section: 'Admin', icon: '⚙️' },
    '/profile': { title: 'User Profile', section: 'Account', icon: '👤' },
    '/users': { title: 'User Management', section: 'Admin', icon: '👥' },
};

const Navbar = ({ toggleSidebar }) => {
    const { billingSettings } = useContext(InventoryContext);
    const { user, logout } = useContext(AuthContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const isDark = theme === 'dark';
    const activeApp = sessionStorage.getItem('activeApp') || 'inventory';

    // Get page info
    const matchedPath = Object.keys(PAGE_TITLES).find(p =>
        location.pathname === p || (p !== '/' && location.pathname.startsWith(p + '/'))
    );
    const pageInfo = PAGE_TITLES[matchedPath] || { title: 'Inventory Suite', section: 'Management', icon: '📦' };

    // Shortcut Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('global-search-input')?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        navigate(`/inventory?search=${encodeURIComponent(searchQuery.trim())}`);
    };

    const handleNewOrderClick = (e) => {
        if (location.pathname === '/sales-orders') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('open-create-order'));
        }
    };

    return (
        <header
            className="print:hidden sticky top-0 z-30 transition-colors duration-200"
            style={{
                height: '64px',
                background: isDark ? '#1e1f20' : '#ffffff',
                borderBottom: isDark ? '1px solid #444746' : '1px solid #dadce0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
            }}
        >
            {/* Left Section: Mobile Toggle + Breadcrumbs / Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                {/* Sidebar toggle button (Google Circular Icon Button) */}
                <button
                    onClick={toggleSidebar}
                    aria-label="Toggle Navigation Menu"
                    title="Toggle menu (collapse/expand)"
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'transparent',
                        color: isDark ? '#c4c7c5' : '#444746',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = isDark ? '#282a2c' : '#f0f4f9';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    <Bars3Icon style={{ width: '22px', height: '22px' }} />
                </button>

                {/* Mobile Brand / App Icon */}
                <div className="flex lg:hidden items-center gap-2">
                    {billingSettings?.branding?.logoUrl ? (
                        <img src={billingSettings.branding.logoUrl} alt="Logo" style={{ height: '24px', objectFit: 'contain' }} />
                    ) : (
                        <div style={{
                            width: '30px', height: '30px', borderRadius: '50%',
                            background: '#0b57d0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 700, fontSize: '12px', fontFamily: 'Inter, sans-serif'
                        }}>
                            IM
                        </div>
                    )}
                </div>

                {/* Desktop Breadcrumb Header - Clickable Links */}
                <div className="hidden lg:flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <Link
                        to="/dashboard"
                        title="Go to Overview Dashboard"
                        style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: isDark ? '#8e918f' : '#747775',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            transition: 'color 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#0b57d0'}
                        onMouseLeave={e => e.currentTarget.style.color = isDark ? '#8e918f' : '#747775'}
                    >
                        {pageInfo.section}
                    </Link>
                    <span style={{ color: isDark ? '#444746' : '#dadce0', fontSize: '0.85rem' }}>/</span>
                    <Link
                        to={location.pathname}
                        title={`Current page: ${pageInfo.title}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            textDecoration: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <span style={{ fontSize: '0.95rem' }}>{pageInfo.icon}</span>
                        <h1 style={{
                            margin: 0,
                            fontSize: '0.94rem',
                            fontWeight: 600,
                            color: isDark ? '#f1f3f4' : '#1f1f1f',
                            fontFamily: 'Inter, sans-serif',
                            letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap'
                        }}>
                            {pageInfo.title}
                        </h1>
                    </Link>
                </div>
            </div>

            {/* Middle Section: Gmail-style Pill Search Bar */}
            <div className="hidden md:flex items-center flex-1 max-w-xl mx-6">
                <form onSubmit={handleSearchSubmit} style={{ width: '100%', position: 'relative' }}>
                    <MagnifyingGlassIcon style={{
                        width: '18px', height: '18px',
                        position: 'absolute', left: '16px', top: '50%',
                        transform: 'translateY(-50%)',
                        color: isDark ? '#c4c7c5' : '#444746',
                        pointerEvents: 'none'
                    }} />
                    <input
                        id="global-search-input"
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search items, orders, parties..."
                        style={{
                            width: '100%',
                            height: '42px',
                            paddingLeft: '44px',
                            paddingRight: '48px',
                            fontSize: '0.875rem',
                            fontFamily: 'Inter, sans-serif',
                            background: isDark ? '#282a2c' : '#eaf1fb',
                            border: '1px solid transparent',
                            borderRadius: '9999px',
                            color: isDark ? '#f1f3f4' : '#1f1f1f',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                        }}
                        onFocus={e => {
                            e.currentTarget.style.borderColor = isDark ? '#444746' : '#dadce0';
                            e.currentTarget.style.background = isDark ? '#1e1f20' : '#ffffff';
                            e.currentTarget.style.boxShadow = isDark
                                ? '0 1px 3px 0 rgba(0,0,0,0.4), 0 4px 8px 3px rgba(0,0,0,0.3)'
                                : '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)';
                        }}
                        onBlur={e => {
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.background = isDark ? '#282a2c' : '#eaf1fb';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    />
                    {/* Gmail-style Search Filter / Sliders Button */}
                    <button
                        type="submit"
                        title="Search (or press Ctrl+K)"
                        style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isDark ? '#c4c7c5' : '#444746',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : '#d3e3fd'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="21" x2="4" y2="14"/>
                            <line x1="4" y1="10" x2="4" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12" y2="3"/>
                            <line x1="20" y1="21" x2="20" y2="16"/>
                            <line x1="20" y1="12" x2="20" y2="3"/>
                            <line x1="1" y1="14" x2="7" y2="14"/>
                            <line x1="9" y1="8" x2="15" y2="8"/>
                            <line x1="17" y1="16" x2="23" y2="16"/>
                        </svg>
                    </button>
                </form>
            </div>

            {/* Right Section: Status Pill + Compose Button + Theme + User Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Live Sync Status Pill - Subtle & Calm */}
                <div className="hidden sm:flex items-center gap-1.5" style={{
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    background: isDark ? 'rgba(15, 82, 35, 0.3)' : '#e6f4ea',
                    border: isDark ? '1px solid rgba(19, 115, 51, 0.4)' : '1px solid #ceead6',
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    color: isDark ? '#81c995' : '#137333',
                    fontFamily: 'Inter, sans-serif',
                    whiteSpace: 'nowrap'
                }}>
                    <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#137333',
                        display: 'inline-block'
                    }} />
                    <span>Live Sync</span>
                </div>

                {/* Quick Action: Google Workspace "Compose" Style Pill */}
                <Link
                    to="/sales-orders?create=true"
                    onClick={handleNewOrderClick}
                    className="hidden sm:inline-flex items-center gap-1.5"
                    style={{
                        height: '38px',
                        padding: '0 16px',
                        borderRadius: '9999px',
                        background: isDark ? '#004a77' : '#c2e7ff',
                        color: isDark ? '#c2e7ff' : '#001d35',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        fontFamily: 'Inter, sans-serif',
                        boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3)',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = isDark ? '#005a8f' : '#b3d7f5';
                        e.currentTarget.style.boxShadow = '0 1px 3px 1px rgba(60,64,67,0.15)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = isDark ? '#004a77' : '#c2e7ff';
                        e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.3)';
                    }}
                >
                    <PlusIcon style={{ width: '16px', height: '16px', strokeWidth: 2.5 }} />
                    <span>New Order</span>
                </Link>

                {/* Theme Toggle Button - Round Google Icon Button */}
                <button
                    onClick={toggleTheme}
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'transparent',
                        color: isDark ? '#fdd663' : '#444746',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = isDark ? '#282a2c' : '#f0f4f9';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    {isDark ? (
                        <SunIcon style={{ width: '19px', height: '19px' }} />
                    ) : (
                        <MoonIcon style={{ width: '19px', height: '19px' }} />
                    )}
                </button>

                {/* User Avatar with Profile Link - Google Circular Account Style */}
                <Link
                    to="/profile"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                        padding: '4px 8px 4px 4px',
                        borderRadius: '9999px',
                        border: isDark ? '1px solid #444746' : '1px solid #dadce0',
                        background: 'transparent',
                        transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = isDark ? '#282a2c' : '#f0f4f9';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: '#0b57d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: 'Inter, sans-serif'
                    }}>
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="hidden lg:block" style={{ textAlign: 'left', lineHeight: 1.15, paddingRight: '4px' }}>
                        <span style={{
                            display: 'block',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: isDark ? '#f1f3f4' : '#1f1f1f',
                            fontFamily: 'Inter, sans-serif'
                        }}>
                            {user?.name?.split(' ')[0] || 'Admin'}
                        </span>
                        <span style={{
                            display: 'block',
                            fontSize: '0.65rem',
                            color: isDark ? '#8e918f' : '#747775',
                            textTransform: 'capitalize',
                            fontFamily: 'Inter, sans-serif'
                        }}>
                            {user?.role?.replace(/_/g, ' ') || 'Staff'}
                        </span>
                    </div>
                </Link>
            </div>
        </header>
    );
};

export default Navbar;
