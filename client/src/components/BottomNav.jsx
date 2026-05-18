import { Link, useLocation } from 'react-router-dom';
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

    const navItems = [
        { name: 'Home', path: '/dashboard', icon: HomeIcon, activeIcon: HomeIconSolid },
        { name: 'Inventory', path: '/inventory', icon: CubeIcon, activeIcon: CubeIconSolid },
        { name: 'Sales', path: '/sales-orders', icon: ShoppingCartIcon, activeIcon: ShoppingCartSolid },
        { name: 'Reports', path: '/reports', icon: ChartBarIcon, activeIcon: ChartBarSolid },
        { name: 'Profile', path: '/profile', icon: UserIcon, activeIcon: UserIconSolid },
    ];

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-1 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] print:hidden">
            <div className="flex justify-around items-center">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = isActive ? item.activeIcon : item.icon;
                    
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center p-2 min-w-[64px] transition-all duration-200 ${
                                isActive ? 'text-rose-600' : 'text-gray-400'
                            }`}
                        >
                            <Icon className="w-6 h-6" />
                            <span className="text-[10px] font-bold mt-1 uppercase tracking-tight">
                                {item.name}
                            </span>
                            {isActive && (
                                <div className="w-1 h-1 bg-rose-600 rounded-full mt-0.5" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
