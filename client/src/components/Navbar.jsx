import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';

const Navbar = ({ toggleSidebar }) => {
    const { billingSettings, branches } = useContext(InventoryContext);
    const { user, activeBranchId, setActiveBranch } = useContext(AuthContext);
    const [showBranchMenu, setShowBranchMenu] = useState(false);

    const activeApp = localStorage.getItem('activeApp') || 'inventory';

    // Determine which branches this user can switch between
    const isAdmin = !user?.branchIds?.length; // empty branchIds = admin sees all
    const viewableBranches = isAdmin ? branches : branches.filter(b => user?.branchIds?.includes(b._id));
    const activeBranch = branches.find(b => b._id === activeBranchId);

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
            
            <div className="flex items-center space-x-2">
                {/* Branch selector for mobile */}
                {viewableBranches.length > 0 && (
                    <div className="relative">
                        <button
                            onClick={() => setShowBranchMenu(!showBranchMenu)}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors max-w-[110px]"
                        >
                            <span>🏪</span>
                            <span className="truncate">{activeBranch?.code || (isAdmin ? 'All' : viewableBranches[0]?.code)}</span>
                            <span className="opacity-60 text-[8px]">▼</span>
                        </button>
                        {showBranchMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowBranchMenu(false)} />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 py-1 overflow-hidden">
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Select Branch</div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => { setActiveBranch(null); setShowBranchMenu(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${!activeBranchId ? 'text-primary-600 font-semibold' : 'text-gray-700'}`}
                                        >
                                            <span>🏢</span> All Branches
                                            {!activeBranchId && <span className="ml-auto text-primary-500 text-xs">●</span>}
                                        </button>
                                    )}
                                    {viewableBranches.map(b => (
                                        <button
                                            key={b._id}
                                            onClick={() => { setActiveBranch(b._id); setShowBranchMenu(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50 ${activeBranchId === b._id ? 'text-primary-600 font-semibold' : 'text-gray-700'}`}
                                        >
                                            <span>{b.isHeadOffice ? '🏛️' : '🏪'}</span>
                                            <div>
                                                <div className="leading-none">{b.name}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">{b.code}</div>
                                            </div>
                                            {activeBranchId === b._id && <span className="ml-auto text-primary-500 text-xs">●</span>}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600 text-[10px] font-bold">
                    {user?.name?.charAt(0)}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
