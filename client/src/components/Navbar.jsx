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
                height: '60px',
                background: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                boxShadow: isDark
                    ? '0 1px 3px rgba(0, 0, 0, 0.3)'
                    : '0 1px 2px rgba(0, 0, 0, 0.03), 0 2px 4px rgba(0, 0, 0, 0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
            }}
        >
            {/* Left Section: Mobile Toggle + Breadcrumbs / Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                {/* Sidebar toggle button (Mobile & Desktop) */}
                <button
                    onClick={toggleSidebar}
                    aria-label="Toggle Navigation"
                    style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '9px',
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                        color: isDark ? '#94a3b8' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = isDark ? 'rgba(99,102,241,0.2)' : '#eef2ff';
                        e.currentTarget.style.color = '#6366f1';
                        e.currentTarget.style.borderColor = '#c7d2fe';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc';
                        e.currentTarget.style.color = isDark ? '#94a3b8' : '#475569';
                        e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
                    }}
                >
                    <Bars3Icon style={{ width: '20px', height: '20px' }} />
                </button>

                {/* Mobile Brand / App Icon */}
                <div className="flex lg:hidden items-center gap-2">
                    {billingSettings?.branding?.logoUrl ? (
                        <img src={billingSettings.branding.logoUrl} alt="Logo" style={{ height: '24px', objectFit: 'contain' }} />
                    ) : (
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '7px',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 800, fontSize: '12px', fontFamily: 'Outfit, sans-serif'
                        }}>
                            IM
                        </div>
                    )}
                </div>

                {/* Desktop Breadcrumb Header */}
                <div className="hidden lg:flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: isDark ? '#64748b' : '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                    }}>
                        {pageInfo.section}
                    </span>
                    <span style={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: '0.85rem' }}>/</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.95rem' }}>{pageInfo.icon}</span>
                        <h1 style={{
                            margin: 0,
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: isDark ? '#f8fafc' : '#0f172a',
                            fontFamily: 'Outfit, sans-serif',
                            letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap'
                        }}>
                            {pageInfo.title}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Middle Section: Omni Search (Hidden on small mobile) */}
            <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
                <form onSubmit={handleSearchSubmit} style={{ width: '100%', position: 'relative' }}>
                    <MagnifyingGlassIcon style={{
                        width: '16px', height: '16px',
                        position: 'absolute', left: '12px', top: '50%',
                        transform: 'translateY(-50%)',
                        color: isDark ? '#64748b' : '#94a3b8',
                        pointerEvents: 'none'
                    }} />
                    <input
                        id="global-search-input"
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search items, orders, parties... (Ctrl+K)"
                        style={{
                            width: '100%',
                            height: '36px',
                            paddingLeft: '36px',
                            paddingRight: '64px',
                            fontSize: '0.82rem',
                            fontFamily: 'Inter, sans-serif',
                            background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                            borderRadius: '10px',
                            color: isDark ? '#f8fafc' : '#0f172a',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                        }}
                        onFocus={e => {
                            e.currentTarget.style.borderColor = '#6366f1';
                            e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.95)' : '#ffffff';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
                        }}
                        onBlur={e => {
                            e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
                            e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    />
                    <kbd style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                        color: isDark ? '#94a3b8' : '#64748b',
                        padding: '2px 6px',
                        borderRadius: '5px',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        fontFamily: 'Inter, sans-serif',
                        pointerEvents: 'none'
                    }}>
                        ⌘K
                    </kbd>
                </form>
            </div>

            {/* Right Section: Status Pill + Quick Action + Theme + User Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Live Sync Status Pill */}
                <div className="hidden sm:flex items-center gap-1.5" style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #a7f3d0',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#059669',
                    fontFamily: 'Inter, sans-serif',
                    whiteSpace: 'nowrap'
                }}>
                    <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#10b981',
                        display: 'inline-block',
                        boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)'
                    }} />
                    <span>Live Sync</span>
                </div>

                {/* Quick Action: New Order */}
                <Link
                    to="/sales-orders?create=true"
                    onClick={handleNewOrderClick}
                    className="hidden sm:inline-flex items-center gap-1.5"
                    style={{
                        height: '34px',
                        padding: '0 12px',
                        borderRadius: '9px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        fontFamily: 'Inter, sans-serif',
                        boxShadow: '0 2px 6px rgba(99,102,241,0.3)',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <PlusIcon style={{ width: '15px', height: '15px', strokeWidth: 2.5 }} />
                    <span>New Order</span>
                </Link>

                {/* Theme Toggle Button */}
                <button
                    onClick={toggleTheme}
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '9px',
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                        color: isDark ? '#fbbf24' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc';
                    }}
                >
                    {isDark ? (
                        <SunIcon style={{ width: '18px', height: '18px' }} />
                    ) : (
                        <MoonIcon style={{ width: '18px', height: '18px' }} />
                    )}
                </button>

                {/* User Avatar with Profile Link */}
                <Link
                    to="/profile"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                        padding: '3px 8px 3px 4px',
                        borderRadius: '10px',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                        transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';
                        e.currentTarget.style.borderColor = '#c7d2fe';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc';
                        e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
                    }}
                >
                    <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 700,
                        fontFamily: 'Outfit, sans-serif'
                    }}>
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="hidden lg:block" style={{ textAlign: 'left', lineHeight: 1.15 }}>
                        <span style={{
                            display: 'block',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: isDark ? '#f8fafc' : '#0f172a',
                            fontFamily: 'Outfit, sans-serif'
                        }}>
                            {user?.name?.split(' ')[0] || 'Admin'}
                        </span>
                        <span style={{
                            display: 'block',
                            fontSize: '0.65rem',
                            color: isDark ? '#94a3b8' : '#64748b',
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
