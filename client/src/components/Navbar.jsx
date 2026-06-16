import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { InventoryContext } from '../context/InventoryContext';

const Navbar = ({ toggleSidebar }) => {
    const { billingSettings } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);

    const activeApp = sessionStorage.getItem('activeApp') || 'inventory';

    return (
        <header className="lg:hidden bg-[#1a1f2e] text-white px-4 py-2 flex items-center justify-between sticky top-0 z-50 shadow-sm print:hidden">
            <div className="flex items-center space-x-3">
                <button 
                    onClick={toggleSidebar}
                    className="p-1.5 -ml-1 hover:bg-slate-800 rounded-lg transition-colors"
                    aria-label="Toggle Menu"
                >
                    <span className="text-xl">☰</span>
                </button>
                {billingSettings?.branding?.logoUrl ? (
                    <img src={billingSettings.branding.logoUrl} alt="Company Logo" className="h-6 w-auto mr-2" />
                ) : (
                    <div className="flex items-center space-x-2">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-lg ${activeApp === 'assets' ? 'bg-blue-600' : 'bg-primary-600'}`}>
                            {activeApp === 'assets' ? '🖥️' : '📦'}
                        </div>
                        <h1 className="text-lg font-bold truncate">
                            {activeApp === 'assets' ? 'Asset Management' : 'InventoryPro'}
                        </h1>
                    </div>
                )}
            </div>
            
            <div className="flex items-center space-x-3">
                <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600 text-[10px] font-bold">
                    {user?.name?.charAt(0)}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
