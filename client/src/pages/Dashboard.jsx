import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [statsRes, lowStockRes] = await Promise.all([
                api.get('/dashboard/stats'),
                api.get('/dashboard/low-stock'),
            ]);
            setStats(statsRes.data);
            setLowStockItems(lowStockRes.data);
        } catch (error) {
            toast.error('Failed to fetch dashboard data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-rose-600"></div>
            </div>
        );
    }

    return (
        <div className="p-1 space-y-6 max-w-[1600px] mx-auto">
            {/* Header Section */}
            <div className="flex justify-between items-end pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center text-xl">🏠</div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Hello, {stats?.userName || 'User'}!</h1>
                        <p className="text-xs text-gray-400 font-medium">{stats?.companyName || 'Inventory Management'}</p>
                    </div>
                </div>
                <button onClick={fetchDashboardData} className="p-2 text-gray-400 hover:text-rose-600 transition-colors">
                    🔄 Refresh
                </button>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Main Content: Left 8 Columns */}
                <div className="col-span-12 lg:col-span-8 space-y-6">

                    {/* Sales Activity Header */}
                    <div className="zoho-card p-6 border-l-4 border-l-rose-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Sales Activity</h2>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">This Month</span>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-gray-100">
                            {[
                                { key: 'packed', label: 'To Be Packed', color: 'text-blue-600', icon: '📦' },
                                { key: 'shipped', label: 'To Be Shipped', color: 'text-rose-500', icon: '🚚' },
                                { key: 'delivered', label: 'To Be Delivered', color: 'text-emerald-500', icon: '🏠' },
                                { key: 'invoiced', label: 'To Be Invoiced', color: 'text-yellow-600', icon: '📄' }
                            ].map((activity) => (
                                <div key={activity.key} className="px-4 text-center group cursor-pointer">
                                    <div className={`text-3xl font-black mb-1 ${activity.color}`}>
                                        {stats?.salesActivity?.[activity.key] || 0}
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight group-hover:text-gray-600">
                                        {activity.icon} {activity.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Product Details & Top Selling */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="zoho-card p-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-1">Product Details</h3>
                            <div className="space-y-4">
                                {[
                                    { label: 'Low Stock Items', value: stats?.lowStockItems || 0, color: 'text-rose-600', path: '/inventory' },
                                    { label: 'Active Item Groups', value: stats?.totalCategories || 0, color: 'text-slate-700' },
                                    { label: 'Active Items', value: stats?.totalItems || 0, color: 'text-slate-700' },
                                    { label: 'Unconfirmed Items', value: stats?.outOfStockItems || 0, color: 'text-yellow-600' }
                                ].map((row, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg transition-colors group cursor-pointer">
                                        <span className="text-xs text-gray-500 font-medium group-hover:text-gray-700">{row.label}</span>
                                        <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="zoho-card p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Top Selling Items</h3>
                                <select className="text-[10px] bg-transparent border-none font-bold text-gray-500 outline-none cursor-pointer">
                                    <option>This Year</option>
                                    <option>Previous Year</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {stats?.topSellingItems?.length > 0 ? (
                                    stats.topSellingItems.slice(0, 2).map((item, i) => (
                                        <div key={i} className="text-center p-3 border border-gray-50 rounded-xl bg-slate-50/50">
                                            <div className="text-xl mb-1">{i === 0 ? '👔' : '👖'}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase truncate" title={item.name}>{item.name}</div>
                                            <div className="text-xs font-black text-gray-700">{item.totalSold} pcs</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 text-center py-4 text-[10px] text-gray-400 font-bold uppercase">No sales yet</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Order Summaries */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="zoho-card p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Purchase Order</h3>
                                <span className="text-[10px] text-gray-400 font-bold">Total</span>
                            </div>
                            <div className="flex flex-col items-center justify-center h-24 bg-gray-50/30 rounded-xl border border-dashed border-gray-200">
                                <span className="text-2xl font-black text-rose-600">{formatCurrency(stats?.totalPurchase || 0)}</span>
                                <span className="text-[10px] text-gray-400 uppercase font-bold mt-1">Total Purchased</span>
                            </div>
                        </div>
                        <div className="zoho-card p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Sales Order</h3>
                                <span className="text-[10px] text-gray-400 font-bold">Summary</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                                {[
                                    { status: 'draft', label: 'Draft' },
                                    { status: 'confirmed', label: 'Confirmed' },
                                    { status: 'packed', label: 'Packed' },
                                    { status: 'shipped', label: 'Shipped' }
                                ].map((s, i) => (
                                    <div key={i} className="text-center p-2 rounded-lg bg-gray-50/50">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase leading-tight mb-1">{s.label}</div>
                                        <div className="text-sm font-black text-gray-700">{stats?.salesActivity?.[s.status] || 0}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Column: Right 4 Columns */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    {/* Inventory Summary Widget */}
                    <div className="zoho-card overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-gray-100">
                            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Inventory Summary</h3>
                        </div>
                        <div className="p-0">
                            <div className="flex items-center justify-between p-5 border-b border-gray-50 hover:bg-slate-50/30 transition-colors">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-tighter">Quantity in Hand</span>
                                <span className="text-lg font-black text-gray-800">{stats?.totalItemsCount || '0'}</span>
                            </div>
                            <div className="flex items-center justify-between p-5 hover:bg-slate-50/30 transition-colors">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-tighter">Quantity to be Received</span>
                                <span className="text-lg font-black text-gray-800">{stats?.pendingReceipts || '168'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stock Value Card */}
                    <div className="zoho-card p-6 bg-gradient-to-br from-white to-rose-50/30">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Global Value</h3>
                            <span className="text-lg">💰</span>
                        </div>
                        <div className="text-3xl font-black text-rose-600 tracking-tighter mb-1">
                            {formatCurrency(stats?.stockValue || 0)}
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Total Valuation of Stock</div>
                    </div>

                    {/* Active Channels / Integrations */}
                    <div className="zoho-card p-6 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 text-6xl opacity-5 transition-transform group-hover:scale-110">🔌</div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Integrations</h3>
                        <div className="flex items-center space-x-2">
                            <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-rose-500 font-bold">Z</span>
                            <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 font-bold">F</span>
                            <span className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 font-bold">+</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium mt-3 italic">Connect with Shopify, Amazon, and more.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
