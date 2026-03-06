import { useContext, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { UserCircleIcon, ArrowRightOnRectangleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/dashboard" className="flex items-center">
                            <div className="flex-shrink-0 flex items-center gap-2">
                                <div className="bg-primary-600 rounded-lg p-1.5 flex items-center justify-center">
                                    <span className="text-xl text-white">📦</span>
                                </div>
                                <h1 className="text-xl font-bold text-gray-900 tracking-tight hidden sm:block">
                                    InventoryPro
                                </h1>
                            </div>
                        </Link>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="flex items-center space-x-3 focus:outline-none hover:bg-gray-50 p-2 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                            >
                                <div className="w-8 h-8 bg-gradient-to-tr from-primary-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium shadow-sm">
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="hidden md:flex flex-col items-start">
                                    <p className="text-sm font-semibold text-gray-700 leading-none">{user?.name}</p>
                                    <p className="text-xs text-gray-500 capitalize mt-1.5 leading-none">{user?.role}</p>
                                </div>
                                <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none transition-all duration-200 ease-out transform scale-100 opacity-100">
                                    <div className="px-4 py-3 border-b border-gray-100 md:hidden">
                                        <p className="text-sm leading-5 font-medium text-gray-900 truncate">{user?.name}</p>
                                        <p className="text-xs leading-5 text-gray-500 truncate">{user?.email}</p>
                                    </div>
                                    <Link
                                        to="/profile"
                                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <UserCircleIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                                        Your Profile
                                    </Link>
                                    <button
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            handleLogout();
                                        }}
                                        className="flex w-full items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                                    >
                                        <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-red-400 group-hover:text-red-500" />
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
