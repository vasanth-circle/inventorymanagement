import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
            <div className="max-w-[1600px] mx-auto px-6">
                <div className="flex justify-between h-14 items-center">
                    {/* Left: Quick Search */}
                    <div className="flex-1 max-w-xl">
                        <div className="relative group">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                                🔍
                            </span>
                            <input
                                type="text"
                                placeholder="Search across modules..."
                                className="block w-full pl-10 pr-3 py-1.5 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 sm:text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Right: User Actions */}
                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2 text-gray-400">
                            <button className="p-2 hover:bg-gray-50 rounded-lg">➕</button>
                            <button className="p-2 hover:bg-gray-50 rounded-lg">🔔</button>
                            <button className="p-2 hover:bg-gray-50 rounded-lg">⚙️</button>
                        </div>

                        <div className="h-6 w-px bg-gray-200"></div>

                        <div className="flex items-center space-x-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-gray-700">{user?.name}</p>
                                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tighter">Zylker</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors border border-slate-200"
                            >
                                👤
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
