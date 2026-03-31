import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

const Navbar = ({ toggleSidebar }) => {
    const { user } = useContext(AuthContext);

    return (
        <header className="lg:hidden bg-[#1a1f2e] text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
            <div className="flex items-center space-x-3">
                <button 
                    onClick={toggleSidebar}
                    className="p-2 -ml-2 hover:bg-slate-800 rounded-lg transition-colors"
                    aria-label="Toggle Menu"
                >
                    <span className="text-2xl">☰</span>
                </button>
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white text-xl">📦</div>
                    <span className="font-bold tracking-tight">InventoryPro</span>
                </div>
            </div>
            
            <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600 text-xs font-bold">
                    {user?.name?.charAt(0)}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
