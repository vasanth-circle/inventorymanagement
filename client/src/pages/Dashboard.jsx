import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
    BarChart, Bar, Cell 
} from 'recharts';

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const [stats, setStats] = useState(null);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(true);

    const isFinancialAdmin = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager', 'accounts'].includes(user?.role);
    const isAdmin = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager'].includes(user?.role);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [statsRes, lowStockRes, trendRes] = await Promise.all([
                api.get('/dashboard/stats'),
                api.get('/dashboard/low-stock'),
                api.get('/dashboard/stock-trend'),
            ]);
            setStats(statsRes.data);
            setLowStockItems(lowStockRes.data);
            
            // Process trend data for Recharts
            const processedTrend = processTrendData(trendRes.data);
            setTrendData(processedTrend);
        } catch (error) {
            toast.error('Failed to fetch dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const processTrendData = (data) => {
        const dateMap = {};
        data.forEach(item => {
            const date = item._id.date;
            if (!dateMap[date]) {
                dateMap[date] = { date, inward: 0, outward: 0 };
            }
            dateMap[date][item._id.type] = item.total;
        });
        return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
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

                    {/* Stock Movement Graph */}
                    <div className="zoho-card p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Stock Movement Trend (Last 7 Days)</h3>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Inward</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Sales</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}}
                                        tickFormatter={(str) => new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                    />
                                    <YAxis hide />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                                        itemStyle={{ padding: '2px 0' }}
                                    />
                                    <Area type="monotone" dataKey="inward" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                                    <Area type="monotone" dataKey="outward" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
                                </AreaChart>
                            </ResponsiveContainer>
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
                                    { label: 'Unconfirmed Items', value: stats?.outOfStockItems || 0, color: 'text-yellow-600' },
                                    { label: 'Damaged Stock', value: stats?.totalDamagedItems || 0, color: 'text-red-500' }
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

                    {/* Financial Overview (Amount Flow) */}
                    {isFinancialAdmin && (
                        <div className="zoho-card p-6 border-l-4 border-l-emerald-500">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Financial Overview (Amount Flow)</h2>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Net Volume</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-x divide-gray-100">
                                <div className="text-center">
                                    <div className="text-2xl font-black text-rose-600 mb-1">
                                        {formatCurrency(stats?.totalPurchase || 0)}
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                        🛒 Total Purchases
                                    </div>
                                </div>
                                <div className="text-center px-4">
                                    <div className="text-2xl font-black text-emerald-600 mb-1">
                                        {formatCurrency(stats?.totalSales || 0)}
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                        💰 Total Sales
                                    </div>
                                </div>
                                <div className="text-center px-4">
                                    <div className={`text-2xl font-black mb-1 ${(stats?.totalSales - stats?.totalPurchase) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                        {formatCurrency(stats?.totalSales - stats?.totalPurchase)}
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                        📈 Net Flow (S-P)
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
                                <span className="text-lg font-black text-gray-800">{stats?.totalItemsCount || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-5 hover:bg-slate-50/30 transition-colors">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-tighter">Quantity to be Received</span>
                                <span className="text-lg font-black text-gray-800">{stats?.pendingReceipts || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stock Value Card */}
                    {isFinancialAdmin && (
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
                    )}

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
