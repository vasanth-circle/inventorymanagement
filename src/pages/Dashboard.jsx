import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import StatCard from '../components/StatCard';
import toast from 'react-hot-toast';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [stockTrend, setStockTrend] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [statsRes, lowStockRes, transactionsRes, trendRes] = await Promise.all([
                api.get('/dashboard/stats'),
                api.get('/dashboard/low-stock'),
                api.get('/dashboard/recent-transactions'),
                api.get('/dashboard/stock-trend'),
            ]);

            setStats(statsRes.data);
            setLowStockItems(lowStockRes.data);
            setRecentTransactions(transactionsRes.data);
            setStockTrend(trendRes.data);
        } catch (error) {
            toast.error('Failed to fetch dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <button
                    onClick={fetchDashboardData}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Items"
                    value={stats?.totalItems || 0}
                    icon="📦"
                    color="primary"
                />
                <StatCard
                    title="Low Stock Items"
                    value={stats?.lowStockItems || 0}
                    icon="⚠️"
                    color="yellow"
                />
                <StatCard
                    title="Out of Stock"
                    value={stats?.outOfStockItems || 0}
                    icon="❌"
                    color="red"
                />
                <StatCard
                    title="Stock Value"
                    value={formatCurrency(stats?.stockValue || 0)}
                    icon="💰"
                    color="green"
                />
            </div>

            {/* Today's Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Inward</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-3xl font-bold text-green-600">
                                {formatCurrency(stats?.todayInward?.totalValue || 0)}
                            </p>
                            <p className="text-sm text-gray-600">{stats?.todayInward?.total || 0} units ({stats?.todayInward?.count || 0} transactions)</p>
                        </div>
                        <span className="text-5xl">📥</span>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Outward</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-3xl font-bold text-red-600">
                                {formatCurrency(stats?.todayOutward?.totalValue || 0)}
                            </p>
                            <p className="text-sm text-gray-600">{stats?.todayOutward?.total || 0} units ({stats?.todayOutward?.count || 0} transactions)</p>
                        </div>
                        <span className="text-5xl">📤</span>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Distribution */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Category Distribution</h2>
                    {stats?.categoryDistribution?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={stats.categoryDistribution}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="count"
                                >
                                    {stats.categoryDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-gray-500 text-center py-8">No data available</p>
                    )}
                </div>

                {/* Low Stock Alerts */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">Low Stock Alerts</h2>
                        <Link to="/inventory" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                            View All →
                        </Link>
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {lowStockItems.length > 0 ? (
                            lowStockItems.slice(0, 5).map((item) => (
                                <div key={item._id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{item.name}</p>
                                        <p className="text-sm text-gray-600">{item.category?.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-yellow-600">{item.quantity}</p>
                                        <p className="text-xs text-gray-500">Min: {item.minStockThreshold}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-4">No low stock items</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Recent Transactions</h2>
                    <Link to="/inventory" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                        View All →
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {recentTransactions.length > 0 ? (
                                recentTransactions.map((transaction) => (
                                    <tr key={transaction._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {transaction.item?.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${transaction.type === 'inward' ? 'bg-green-100 text-green-800' :
                                                transaction.type === 'outward' ? 'bg-red-100 text-red-800' :
                                                    'bg-blue-100 text-blue-800'
                                                }`}>
                                                {transaction.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {transaction.quantity}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {transaction.user?.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {formatDateTime(transaction.createdAt)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                                        No recent transactions
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
