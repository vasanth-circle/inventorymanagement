import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';

const Navbar = ({ toggleSidebar }) => {
    const { billingSettings } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);
    const activeApp = sessionStorage.getItem('activeApp') || 'inventory';

    return (
        <header className="lg:hidden glass-panel m-2 px-4 py-3 flex items-center justify-between sticky top-2 z-50 print:hidden transition-all duration-300 shadow-sm border border-white/40">
            <div className="flex items-center space-x-3">
                <button 
                    onClick={toggleSidebar}
                    className="p-1.5 -ml-1 text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors focus:ring-2 focus:ring-primary-500"
                    aria-label="Toggle Menu"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
                {billingSettings?.branding?.logoUrl ? (
                    <img src={billingSettings.branding.logoUrl} alt="Company Logo" className="h-6 w-auto mr-2 drop-shadow-sm" />
                ) : (
                    <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-lg shadow-md ${activeApp === 'assets' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-primary-500 to-primary-600'}`}>
                            {activeApp === 'assets' ? '🖥️' : '📦'}
                        </div>
                        <h1 className="text-lg font-bold text-gray-800 tracking-tight truncate">
                            {activeApp === 'assets' ? 'AssetPro' : 'InventoryPro'}
                        </h1>
                    </div>
                )}
            </div>
            
            <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 rounded-full flex items-center justify-center border-2 border-white shadow-sm text-xs font-bold uppercase tracking-wider">
                    {user?.name?.charAt(0) || 'U'}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
