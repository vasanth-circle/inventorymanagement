import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const AssetDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get('/assets/dashboard');
                if(data.success) {
                    setStats(data.data);
                }
            } catch (error) {
                toast.error(error.response?.data?.message || 'Error fetching stats');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const getStatusBadge = (status) => {
        const colors = {
            'Available': 'bg-green-100 text-green-800',
            'Assigned': 'bg-blue-100 text-blue-800',
            'In Service': 'bg-yellow-100 text-yellow-800',
            'Returned': 'bg-purple-100 text-purple-800',
            'Retired': 'bg-red-100 text-red-800'
        };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <Link
                    to="/assets"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-semibold flex items-center"
                >
                    <span className="mr-2">🖥️</span> Manage Assets
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-lg text-2xl mr-4">🖥️</div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Total Assets</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.totalAssets || 0}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-4 bg-teal-50 text-teal-600 rounded-lg text-2xl mr-4">💻</div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Systems</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.totalSystems || 0}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-lg text-2xl mr-4">🚗</div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Vehicles</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.totalVehicles || 0}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-4 bg-yellow-50 text-yellow-600 rounded-lg text-2xl mr-4">🔧</div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">In Service</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.inServiceAssets || 0}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">Recently Added Assets</h2>
                        <Link to="/assets" className="text-sm text-blue-600 hover:text-blue-800 font-semibold">View All</Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Asset</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {stats?.recentAssets?.length > 0 ? (
                                    stats.recentAssets.map(asset => (
                                        <tr key={asset._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-gray-900">{asset.name}</div>
                                                <div className="text-xs text-gray-500">📍 {asset.branch?.name || 'N/A'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{asset.assetType}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStatusBadge(asset.status)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-8 text-center text-gray-500 text-sm">
                                            No recent assets found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-sm p-6 text-white flex flex-col justify-center">
                    <h3 className="text-xl font-bold mb-2">Welcome to AssetPro</h3>
                    <p className="text-blue-100 text-sm mb-6">You are currently in the dedicated Asset Management environment. Here you can efficiently track your hardware, electronics, and vehicles without disturbing your general inventory.</p>
                    <Link to="/profile" className="w-full text-center py-2 px-4 bg-white text-blue-700 rounded-lg hover:bg-blue-50 font-bold transition-colors">
                        Switch Back to Inventory
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AssetDashboard;
