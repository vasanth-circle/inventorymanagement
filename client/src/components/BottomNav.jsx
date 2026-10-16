import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import { 
    HomeIcon, 
    CubeIcon, 
    ShoppingCartIcon, 
    UserIcon,
    ChartBarIcon
} from '@heroicons/react/24/outline';
import { 
    HomeIcon as HomeIconSolid, 
    CubeIcon as CubeIconSolid, 
    ShoppingCartIcon as ShoppingCartSolid, 
    UserIcon as UserIconSolid,
    ChartBarIcon as ChartBarSolid
} from '@heroicons/react/24/solid';

const BottomNav = () => {
    const location = useLocation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';

    const navItems = [
        { name: 'Home', path: '/dashboard', icon: HomeIcon, activeIcon: HomeIconSolid },
        { name: 'Inventory', path: '/inventory', icon: CubeIcon, activeIcon: CubeIconSolid },
        { name: 'Sales', path: '/sales-orders', icon: ShoppingCartIcon, activeIcon: ShoppingCartSolid },
        { name: 'Reports', path: '/reports', icon: ChartBarIcon, activeIcon: ChartBarSolid },
        { name: 'Profile', path: '/profile', icon: UserIcon, activeIcon: UserIconSolid },
    ];

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 print:hidden" style={{
            background: isDark ? 'rgba(15, 23, 42, 0.97)' : 'rgba(255, 255, 255, 0.97)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
            boxShadow: isDark ? '0 -4px 20px rgba(0,0,0,0.3)' : '0 -4px 20px rgba(0,0,0,0.04)',
            padding: '6px 4px 10px',
            zIndex: 30,
            transition: 'background 0.2s ease, border-color 0.2s ease'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = isActive ? item.activeIcon : item.icon;
                    
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                padding: '5px 12px', minWidth: '56px', textDecoration: 'none',
                                borderRadius: '10px', transition: 'all 0.15s ease',
                                color: isActive
                                    ? (isDark ? '#818cf8' : '#4f46e5')
                                    : (isDark ? 'rgba(255,255,255,0.45)' : '#64748b'),
                                background: isActive
                                    ? (isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff')
                                    : 'transparent',
                            }}
                        >
                            <Icon style={{ width: '20px', height: '20px' }} />
                            <span style={{
                                fontSize: '9px', fontWeight: 700, marginTop: '2px',
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                                fontFamily: 'Outfit, sans-serif',
                            }}>
                                {item.name}
                            </span>
                            {isActive && (
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#6366f1', marginTop: '2px' }} />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
